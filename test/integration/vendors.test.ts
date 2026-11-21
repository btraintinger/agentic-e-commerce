import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { client } from "../support/trpc-client";

vi.mock("server-only", () => ({}));

describe.skipIf(!process.env.TEST_DATABASE_URL)("PostgreSQL vendors", () => {
  const api = client();

  it("lists vendors in UUID order and returns the same vendor by uppercase ID", async () => {
    const vendors = await api.vendors.list.query();

    expect(vendors).toHaveLength(5);
    const ids = vendors.map(({ id }) => z.uuid().parse(id));
    expect(ids).toEqual([...ids].sort());
    const [vendor] = vendors;
    await expect(
      api.vendors.byId.query({ id: vendor.id.toUpperCase() }),
    ).resolves.toEqual(vendor);
  });

  it.each(["missing", "00000000-0000-4000-8000-000000000000"])(
    "returns NOT_FOUND for vendor ID %s",
    async (id) => {
      await expect(api.vendors.byId.query({ id })).rejects.toMatchObject({
        data: { code: "NOT_FOUND", httpStatus: 404 },
      });
    },
  );
});
