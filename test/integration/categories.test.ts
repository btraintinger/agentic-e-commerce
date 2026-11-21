import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { client } from "../support/trpc-client";

vi.mock("server-only", () => ({}));

describe.skipIf(!process.env.TEST_DATABASE_URL)("PostgreSQL categories", () => {
  const api = client();

  it("lists categories in UUID order", async () => {
    const categories = await api.categories.list.query();

    expect(categories).toHaveLength(6);
    const ids = categories.map(({ id }) => z.uuid().parse(id));
    expect(ids).toEqual([...ids].sort());
  });

  it("lists only products in the requested category, including for an uppercase ID", async () => {
    const [category] = await api.categories.list.query();
    const all = await api.products.list.query();
    const expected = all.filter(({ categoryId }) => categoryId === category.id);

    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(all.length);
    await expect(
      api.categories.products.query({ id: category.id.toUpperCase() }),
    ).resolves.toEqual(expected);
  });

  it.each(["missing", "00000000-0000-4000-8000-000000000000"])(
    "returns NOT_FOUND for category ID %s",
    async (id) => {
      await expect(api.categories.products.query({ id })).rejects.toMatchObject(
        {
          data: { code: "NOT_FOUND", httpStatus: 404 },
        },
      );
    },
  );
});
