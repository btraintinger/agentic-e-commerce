import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/trpc/[trpc]/route";
import { client } from "../support/trpc-client";

vi.mock("server-only", () => ({}));

const api = client();

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", undefined);
  vi.stubEnv("VERCEL", "0");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

it.each([0, -1, 1.5])(
  "rejects cart quantity %s without needing a database connection",
  async (quantity) => {
    await expect(
      api.cart.validate.mutate({
        items: [{ offerId: "offer", quantity }],
      }),
    ).rejects.toMatchObject({
      data: {
        code: "BAD_REQUEST",
        httpStatus: 400,
        zodError: { fieldErrors: { items: [expect.any(String)] } },
      },
    });
  },
);

it("validates an empty cart without needing a database connection", async () => {
  await expect(api.cart.validate.mutate({ items: [] })).resolves.toEqual({
    valid: true,
    issues: [],
    shipments: [],
    totals: { items: 0, shipping: 0, discount: 0, grand: 0 },
    deliveryDays: null,
    packageCount: 0,
  });
});

it.each(["vouchers.list", "vouchers.byId"])(
  "does not expose a %s query",
  async (procedure) => {
    const response = await GET(
      new Request(`http://localhost/api/trpc/${procedure}`),
    );
    expect(response.status).toBe(404);
  },
);
