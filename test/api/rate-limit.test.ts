import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { client } from "../support/trpc-client";

vi.mock("server-only", () => ({}));

const tooManyRequests = {
  data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 },
};
const emptyCart = { items: [] };
let now = 0;

beforeEach(() => {
  now += 120_000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("VERCEL", "0");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("allows five concurrent calls per local window and only limits cart validation", async () => {
  const attempts = await Promise.allSettled(
    Array.from({ length: 7 }, (_, index) =>
      client({
        "x-vercel-forwarded-for": `192.0.2.${index + 1}`,
      }).cart.validate.mutate(emptyCart),
    ),
  );
  expect(
    attempts.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(5);
  expect(
    attempts.filter((result) => result.status === "rejected"),
  ).toMatchObject([{ reason: tooManyRequests }, { reason: tooManyRequests }]);
  const api = client();
  await expect(api.health.check.query()).resolves.toEqual({ status: "ok" });
  now += 59_999;
  await expect(api.cart.validate.mutate(emptyCart)).rejects.toMatchObject(
    tooManyRequests,
  );
  now += 1;
  await expect(api.cart.validate.mutate(emptyCart)).resolves.toMatchObject({
    valid: true,
  });
});

it("keeps distinct Vercel IP windows and groups equivalent IPv6 forms", async () => {
  vi.stubEnv("VERCEL", "1");
  const source = client({ "x-vercel-forwarded-for": "2001:db8::1" });
  for (let i = 0; i < 5; i++) await source.cart.validate.mutate(emptyCart);
  const equivalent = client({
    "x-vercel-forwarded-for": "2001:0db8:0:0:0:0:0:1",
  });
  await expect(
    equivalent.cart.validate.mutate(emptyCart),
  ).rejects.toMatchObject(tooManyRequests);
  now += 30_000;
  const other = client({ "x-vercel-forwarded-for": "192.0.2.1" });
  for (let i = 0; i < 5; i++) await other.cart.validate.mutate(emptyCart);
  now += 30_000;
  await expect(
    equivalent.cart.validate.mutate(emptyCart),
  ).resolves.toMatchObject({
    valid: true,
  });
  await expect(other.cart.validate.mutate(emptyCart)).rejects.toMatchObject(
    tooManyRequests,
  );
});

it("counts each cart call in a tRPC batch", async () => {
  const api = client(undefined, true);
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, () => api.cart.validate.mutate(emptyCart)),
  );
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(5);
  expect(
    results.filter((result) => result.status === "rejected"),
  ).toMatchObject([{ reason: tooManyRequests }]);
});
