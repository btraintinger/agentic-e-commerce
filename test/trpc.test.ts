import { createTRPCClient, httpBatchLink, httpLink } from "@trpc/client";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import superjson from "superjson";
import { afterAll, describe, expect, it } from "vitest";

import { clientRateLimitKey } from "~/server/api/cart-rate-limit";
import { appRouter, type AppRouter } from "~/server/api/root";
import * as schema from "~/server/db/schema";

const connection = postgres("postgresql://unused:unused@127.0.0.1:1/unused");
const db = drizzle(connection, { schema });
const url = "http://localhost/api/trpc";

afterAll(() => connection.end());

function handleRequest(req: Request, rateLimitKey: string) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({
      db,
      headers: req.headers,
      getSession: async () => null,
      rateLimitKey,
    }),
  });
}

function client(ip: string, batch = false) {
  const link = batch ? httpBatchLink : httpLink;
  const statuses: number[] = [];
  const api = createTRPCClient<AppRouter>({
    links: [link({
      url,
      transformer: superjson,
      fetch: async (input, init) => {
        const response = await handleRequest(new Request(input, init), ip);
        statuses.push(response.status);
        return response;
      },
    })],
  });
  return { api, statuses };
}

describe("webshop tRPC HTTP contract", () => {
  it("answers health queries without accessing Postgres", async () => {
    const { api, statuses } = client("192.0.2.1");
    await expect(api.health.query()).resolves.toEqual({ status: "ok" });
    expect(statuses).toEqual([200]);
  });

  it("keeps voucher list and detail procedures private", async () => {
    for (const procedure of ["vouchers.list", "vouchers.byId"]) {
      const response = await handleRequest(new Request(`${url}/${procedure}`), "192.0.2.6");
      expect(response.status).toBe(404);
    }
  });

  it.each([{}, { items: "not-array" }])("rejects malformed cart input %j", async (input) => {
    const response = await handleRequest(new Request(`${url}/cart.validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(superjson.serialize(input)),
    }), "192.0.2.7");
    expect(response.status).toBe(400);
  });

  it("limits cart validation per client and leaves queries unrestricted", async () => {
    const { api, statuses } = client("192.0.2.2");
    const invalid = { items: [{ offerId: "offer", quantity: Number.NaN }] };
    for (let index = 0; index < 5; index++) {
      await expect(api.cart.validate.mutate(invalid)).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
    }
    await expect(api.cart.validate.mutate(invalid)).rejects.toMatchObject({ data: { code: "TOO_MANY_REQUESTS" } });
    await expect(api.health.query()).resolves.toEqual({ status: "ok" });
    expect(statuses).toEqual([400, 400, 400, 400, 400, 429, 200]);
    await expect(client("192.0.2.3").api.cart.validate.mutate(invalid)).rejects.toMatchObject({
      data: { code: "BAD_REQUEST" },
    });
  });

  it("counts every cart operation in one HTTP batch", async () => {
    const { api, statuses } = client("192.0.2.4", true);
    const invalid = { items: [{ offerId: "offer", quantity: Number.NaN }] };
    const errors = await Promise.all(
      Array.from({ length: 6 }, () => api.cart.validate.mutate(invalid).catch((error: unknown) => error)),
    );
    expect(statuses).toEqual([207]);
    expect(errors.filter((error) => (
      error instanceof Error && "data" in error &&
      (error.data as { code?: string } | undefined)?.code === "TOO_MANY_REQUESTS"
    ))).toHaveLength(1);
  });

  it("accepts only a single IP from an explicitly trusted proxy", () => {
    const headers = new Headers({ "x-forwarded-for": "192.0.2.5" });
    expect(clientRateLimitKey(headers, true)).toBe("192.0.2.5");
    expect(clientRateLimitKey(headers, false)).toBe("unidentified");
    headers.set("x-forwarded-for", "192.0.2.5, 192.0.2.6");
    expect(clientRateLimitKey(headers, true)).toBe("unidentified");
  });
});
