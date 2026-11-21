import { asc } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Database } from "@/server/db";
import {
  categories,
  offers,
  products,
  variants,
  vendors,
  vouchers,
  warehouses,
} from "@/server/db/schema";
import { seedCatalog } from "../../scripts/seed/seed";
import { createTestDatabase } from "../support/database";

async function catalogSnapshot(db: Database) {
  return {
    categories: await db.select().from(categories).orderBy(asc(categories.id)),
    products: await db.select().from(products).orderBy(asc(products.id)),
    variants: await db.select().from(variants).orderBy(asc(variants.id)),
    offers: await db.select().from(offers).orderBy(asc(offers.id)),
    vendors: await db.select().from(vendors).orderBy(asc(vendors.id)),
    warehouses: await db.select().from(warehouses).orderBy(asc(warehouses.id)),
    vouchers: await db.select().from(vouchers).orderBy(asc(vouchers.code)),
  };
}

const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)("PostgreSQL catalog seed", () => {
  it("seeds the same complete catalog in independent databases and on rerun", async () => {
    if (!adminUrl) throw new Error("TEST_DATABASE_URL is required");
    const first = await createTestDatabase(adminUrl);
    let second: typeof first | undefined;
    try {
      second = await createTestDatabase(adminUrl);
      const snapshot = await catalogSnapshot(first.db);
      expect(await catalogSnapshot(second.db)).toEqual(snapshot);
      await seedCatalog(first.db);
      expect(await catalogSnapshot(first.db)).toEqual(snapshot);
      expect(snapshot.categories).toHaveLength(6);
      expect(snapshot.products).toHaveLength(201);
      expect(
        snapshot.products.filter((product) =>
          product.tags.includes("starter-set"),
        ),
      ).toHaveLength(12);
      expect(snapshot.variants).toHaveLength(597);
      expect(snapshot.offers).toHaveLength(1784);
      expect(snapshot.vendors).toHaveLength(5);
      expect(snapshot.warehouses).toHaveLength(4);
      expect(snapshot.vouchers).toHaveLength(8);
      expect(new Set(snapshot.offers.map((offer) => offer.stock))).toEqual(
        new Set(["NO", "LITTLE", "ALOT"]),
      );
      expect(snapshot.offers.some((offer) => offer.shippingCost === 0)).toBe(
        true,
      );
      expect(
        snapshot.offers.some(
          (offer) => offer.shippingCost > 0 && offer.freeShippingThreshold,
        ),
      ).toBe(true);
    } finally {
      try {
        await second?.close();
      } finally {
        await first.close();
      }
    }
  }, 30_000);
});
