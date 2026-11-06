import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { generateDataset } from "../scripts/generate-data.mjs";
import { parseDataset, readDataset } from "~/dataset";
import { createCaller } from "~/server/api/root";
import * as schema from "~/server/db/schema";
import { seedCatalog } from "~/server/db/seed-catalog";
import { validateCart } from "~/validate";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgreSQL webshop procedures", () => {
  const connection = postgres(databaseUrl ?? "postgresql://unused:unused@127.0.0.1:1/unused");
  const db = drizzle(connection, { schema });
  const api = createCaller({
    db,
    headers: new Headers(),
    getSession: async () => null,
    rateLimitKey: "postgres-test",
  });
  const dataset = readDataset("data/dataset.json");

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    await seedCatalog(db, dataset);
    await seedCatalog(db, dataset);
  });

  afterAll(() => connection.end());

  it("round-trips seeded catalog data and preserves ordering and optional fields", async () => {
    const category = dataset.categories[0];
    const product = dataset.products[0];
    const vendor = dataset.vendors[0];

    expect(await api.categories.list()).toEqual(dataset.categories);
    expect(await api.categories.products({ id: category.id })).toEqual(
      dataset.products.filter((p) => p.categoryId === category.id),
    );
    expect(await api.products.list()).toEqual(dataset.products);
    expect(await api.products.byId({ id: product.id })).toEqual(product);
    expect(await api.vendors.list()).toEqual(dataset.vendors);
    expect(await api.vendors.byId({ id: vendor.id })).toEqual(vendor);
    expect(await api.warehouses.list()).toEqual(dataset.warehouses);
  });

  it("combines case-insensitive substring search and same-offer price bounds", async () => {
    const category = dataset.categories[0].id;
    for (const q of ["LAPTOP", "%", "_", "\\"]) {
      const filters = { category, q, minPrice: 1_000, maxPrice: 300_000 };
      const expected = dataset.products.filter((product) =>
        product.categoryId === category &&
        [product.name, product.description, product.brand ?? "", ...product.tags]
          .some((text) => text.toLowerCase().includes(q.toLowerCase())) &&
        product.variants.some(({ offers }) =>
          offers.some(({ price }) => price >= filters.minPrice && price <= filters.maxPrice),
        ),
      );
      expect(await api.products.list(filters)).toEqual(expected);
    }
    expect(await api.products.list({ minPrice: 10_000, maxPrice: 1_000 })).toEqual([]);
  });

  it("retains not-found errors for IDs that do not occur in the catalog", async () => {
    await expect(api.categories.products({ id: "missing" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.products.byId({ id: "missing" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.vendors.byId({ id: "missing" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("validates selected offers and vouchers with the existing cart rules", async () => {
    const inStock = dataset.products.flatMap(({ variants }) => variants.flatMap(({ offers }) => offers))
      .filter(({ stock }) => stock !== "NO");
    const primary = inStock[0];
    const second = inStock.find((offer) => offer.warehouseId !== primary.warehouseId)!;
    const cart = {
      items: [
        { offerId: primary.id, quantity: 2 },
        { offerId: second.id, quantity: 1 },
        { offerId: "missing", quantity: 1 },
        { offerId: second.id, quantity: 1.5 },
      ],
      voucherCode: "WELCOME10",
    };
    expect(await api.cart.validate(cart)).toEqual(validateCart(cart, dataset));
  });

  it("handles a cart with more distinct offer IDs than repeated bind lists support", async () => {
    const offer = dataset.products.flatMap(({ variants }) => variants.flatMap(({ offers }) => offers))
      .find(({ stock }) => stock !== "NO")!;
    const validItem = { offerId: offer.id, quantity: 1 };
    const unknownItems = Array.from({ length: 22_000 }, (_, index) => ({
      offerId: index.toString(36),
      quantity: 1,
    }));
    const cart = { items: [...unknownItems, validItem] };
    expect(Buffer.byteLength(JSON.stringify(cart))).toBeLessThan(1024 * 1024);

    const result = await api.cart.validate(cart);
    expect(result.issues).toHaveLength(unknownItems.length);
    expect(result.issues.at(-1)).toMatchObject({ code: "OFFER_NOT_FOUND", offerId: unknownItems.at(-1)?.offerId });
    expect(result.shipments).toEqual(validateCart({ items: [validItem] }, dataset).shipments);
  });

  it("handles NULs and unpaired surrogates as ordinary misses", async () => {
    const ids = ["missing\0id", "missing\uD800id", "missing\uDC00id"];
    for (const id of ids) {
      await expect(api.categories.products({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(api.products.byId({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(api.vendors.byId({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(api.products.list({ q: id })).resolves.toEqual([]);
      await expect(api.products.list({ category: id })).resolves.toEqual([]);
    }

    const offer = dataset.products.flatMap(({ variants }) => variants.flatMap(({ offers }) => offers))
      .find(({ stock }) => stock !== "NO")!;
    const items = [...ids, offer.id].map((offerId) => ({ offerId, quantity: 1 }));
    for (const voucherCode of ["missing\0voucher", "missing\uD800voucher"]) {
      const cart = { items, voucherCode };
      await expect(api.cart.validate(cart)).resolves.toEqual(validateCart(cart, dataset));
    }
  });

  it("looks up a literal empty category ID without changing optional list filtering", async () => {
    const fixture = structuredClone(dataset);
    fixture.categories.push({ id: "", name: "Empty ID", description: "" });
    fixture.products[0].categoryId = "";
    fixture.products[0].tags.push("T3 📚");
    try {
      await seedCatalog(db, fixture);
      await expect(api.categories.products({ id: "" })).resolves.toEqual([fixture.products[0]]);
      await expect(api.products.list({ category: "" })).resolves.toEqual(fixture.products);
      await expect(api.products.list({ q: "📚" })).resolves.toEqual([fixture.products[0]]);
    } finally {
      await seedCatalog(db, dataset);
    }
  });

  it("preserves JavaScript lowercase matching for international product text", async () => {
    const fixture = structuredClone(dataset);
    fixture.products[0].name = "International İZMİR";
    try {
      await seedCatalog(db, fixture);
      await expect(api.products.list({ q: "international İZMİR" })).resolves.toEqual([fixture.products[0]]);
      await expect(api.products.list({ q: "international izmir" })).resolves.toEqual([]);
    } finally {
      await seedCatalog(db, dataset);
    }
  });

  it("rolls back replacement if the selected fixture contains a broken reference", async () => {
    const broken = structuredClone(dataset);
    broken.products[0].categoryId = "missing";
    await expect(seedCatalog(db, broken)).rejects.toThrow();
    expect(await api.products.byId({ id: dataset.products[0].id })).toEqual(dataset.products[0]);
  });

  it("reseeds the fixed JKU catalog and keeps unrelated rows", async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({ id: userId, email: "seed-check@example.invalid" });
    try {
      await db.insert(schema.posts).values({ createdById: userId, name: "Seed check" });

      const generated = parseDataset(generateDataset());
      await seedCatalog(db, generated);
      const products = await api.products.list();
      const warehouses = await api.warehouses.list();
      const vouchers = await db.select().from(schema.vouchers).orderBy(schema.vouchers.code);
      const offers = products.flatMap(({ variants }) => variants.flatMap(({ offers }) => offers));

      expect(products).toEqual(generated.products);
      expect(await api.categories.list()).toEqual(generated.categories);
      expect(products.every(({ variants }) =>
        variants.length > 0 && variants.every(({ offers }) => offers.length > 0),
      )).toBe(true);
      expect(offers.every((offer) =>
        Number.isInteger(offer.price) && offer.price >= 0 &&
        offer.deliveryDays.min <= offer.deliveryDays.max &&
        (offer.freeShippingThreshold === undefined || offer.shippingCost > 0),
      )).toBe(true);
      expect(offers.filter(({ shippingCost }) => shippingCost === 0).length).toBeGreaterThan(offers.length / 2);
      expect(new Set(offers.map(({ stock }) => stock))).toEqual(new Set(["NO", "LITTLE", "ALOT"]));
      expect(warehouses.every(({ country, packageTax }) => packageTax === (country === "AT" ? 300 : undefined)))
        .toBe(true);
      expect(vouchers.map(({ code }) => code)).toEqual(expect.arrayContaining(["WELCOME10", "EXPIRED2024"]));

      await seedCatalog(db, parseDataset(generateDataset()));
      expect(await api.products.list()).toEqual(products);
      expect(await db.select().from(schema.vouchers).orderBy(schema.vouchers.code)).toEqual(vouchers);
      expect(await db.select().from(schema.users).where(eq(schema.users.id, userId))).toHaveLength(1);
      expect(await db.select().from(schema.posts).where(eq(schema.posts.createdById, userId))).toHaveLength(1);
    } finally {
      await db.delete(schema.posts).where(eq(schema.posts.createdById, userId));
      await db.delete(schema.users).where(eq(schema.users.id, userId));
      await seedCatalog(db, dataset);
    }
  });
});
