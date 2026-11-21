import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { client } from "../support/trpc-client";

vi.mock("server-only", () => ({}));

describe.skipIf(!process.env.TEST_DATABASE_URL)("PostgreSQL products", () => {
  const api = client();

  it("lists products with variants and offers and looks up an uppercase product ID", async () => {
    const products = await api.products.list.query();

    expect(products).toHaveLength(201);
    const [product] = products;
    const [variant] = product.variants;
    const [offer] = variant.offers;
    expect(z.uuid().safeParse(product.id).success).toBe(true);
    expect(z.uuid().safeParse(variant.id).success).toBe(true);
    expect(z.uuid().safeParse(offer.id).success).toBe(true);
    expect(variant).not.toHaveProperty("productId");
    expect(offer.currency).toBe("EUR");
    expect(offer.deliveryDays.min).toBeTypeOf("number");
    expect(offer.deliveryDays.max).toBeTypeOf("number");
    expect(offer).not.toHaveProperty("variantId");
    expect(offer).not.toHaveProperty("deliveryDaysMin");
    expect(offer).not.toHaveProperty("deliveryDaysMax");
    await expect(
      api.products.byId.query({ id: product.id.toUpperCase() }),
    ).resolves.toEqual(product);
  });

  it("matches mixed-case substrings in product names, descriptions, brands, and tags", async () => {
    const all = await api.products.list.query();
    for (const q of [
      "hEaDpHoNe",
      "jku LeArNiNg CeNtEr",
      "FJÄLLRÄVEN",
      "STARTER-SET",
    ]) {
      const expected = all.filter((product) =>
        [
          product.name,
          product.description,
          product.brand ?? "",
          ...product.tags,
        ].some((value) => value.toLowerCase().includes(q.toLowerCase())),
      );
      expect(expected.length).toBeGreaterThan(0);
      await expect(api.products.list.query({ q })).resolves.toEqual(expected);
    }
  });

  it("treats SQL pattern characters as literal search text", async () => {
    const all = await api.products.list.query();
    for (const q of ["%", "_", "\\"]) {
      const expected = all.filter((product) =>
        [
          product.name,
          product.description,
          product.brand ?? "",
          ...product.tags,
        ].some((value) => value.includes(q)),
      );
      expect(expected.length).toBeLessThan(all.length);
      await expect(api.products.list.query({ q })).resolves.toEqual(expected);
    }
  });

  it("combines category, search and price filters and accepts one-sided bounds", async () => {
    const all = await api.products.list.query();
    const [category] = await api.categories.list.query();
    const minPrice = 1000;
    const maxPrice = 5000;
    const expected = all.filter((product) =>
      product.variants.some((variant) =>
        variant.offers.some(
          (offer) => offer.price >= minPrice && offer.price <= maxPrice,
        ),
      ),
    );
    expect(expected.length).toBeGreaterThan(0);
    await expect(
      api.products.list.query({ minPrice, maxPrice }),
    ).resolves.toEqual(expected);
    await expect(
      api.products.list.query({ maxPrice: Number.MAX_SAFE_INTEGER }),
    ).resolves.toEqual(all);
    await expect(
      api.products.list.query({ minPrice: Number.MAX_SAFE_INTEGER }),
    ).resolves.toEqual([]);
    await expect(
      api.products.list.query({
        category: category.id,
        q: "student",
        minPrice,
        maxPrice,
      }),
    ).resolves.toEqual(
      expected.filter(
        (product) =>
          product.categoryId === category.id &&
          [
            product.name,
            product.description,
            product.brand ?? "",
            ...product.tags,
          ].some((value) => value.toLowerCase().includes("student")),
      ),
    );
  });

  it("includes exact price bounds and requires the same offer to satisfy both", async () => {
    const q = "ThinkPad X1 Carbon Student Edition";
    const [product] = await api.products.list.query({ q });
    const prices = [
      ...new Set(
        product.variants.flatMap(({ offers }) =>
          offers.map(({ price }) => price),
        ),
      ),
    ].sort((a, b) => a - b);
    const [lowest, next] = prices;
    expect(next).toBeGreaterThan(lowest + 1);

    await expect(
      api.products.list.query({ q, minPrice: lowest, maxPrice: lowest }),
    ).resolves.toEqual([product]);
    await expect(
      api.products.list.query({ q, minPrice: lowest + 1, maxPrice: next - 1 }),
    ).resolves.toEqual([]);
  });

  it.each(["missing", "00000000-0000-4000-8000-000000000000"])(
    "returns NOT_FOUND for product ID %s and an empty list for the same category ID",
    async (id) => {
      await expect(api.products.byId.query({ id })).rejects.toMatchObject({
        data: { code: "NOT_FOUND", httpStatus: 404 },
      });
      await expect(api.products.list.query({ category: id })).resolves.toEqual(
        [],
      );
    },
  );
});
