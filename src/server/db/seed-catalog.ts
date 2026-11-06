import { sql } from "drizzle-orm";
import { pgSchema } from "drizzle-orm/pg-core";
import type { drizzle } from "drizzle-orm/postgres-js";
import { seed } from "drizzle-seed";
import type { Dataset, StockLevel } from "~/types";
import {
  categories, offers, products, variants, vendors, vouchers, warehouses,
} from "./schema";

type SeedDatabase = ReturnType<typeof drizzle>;
type SeedTransaction = Parameters<Parameters<SeedDatabase["transaction"]>[0]>[0];
type OfferRow = typeof offers.$inferInsert;

const offerRefinements = pgSchema("pg_temp").table("jku_offer_refinements", (d) => ({
  ordinal: d.integer().primaryKey(),
  stock: d.text().notNull().$type<StockLevel>(),
  deliveryMin: d.integer("delivery_min").notNull(),
  deliveryMax: d.integer("delivery_max").notNull(),
}));

async function refineOfferRows(tx: SeedTransaction, rows: OfferRow[], offerSeed: number) {
  await tx.execute(sql`create temporary table ${offerRefinements} (
    ordinal integer primary key,
    stock text not null,
    delivery_min integer not null,
    delivery_max integer not null
  ) on commit drop`);
  await seed(tx, { offerRefinements }, { count: rows.length, seed: offerSeed, version: "2" }).refine((f) => ({
    offerRefinements: {
      columns: {
        ordinal: f.intPrimaryKey(),
        stock: f.valuesFromArray({ values: [
          { weight: 0.08, values: ["NO"] },
          { weight: 0.13, values: ["LITTLE"] },
          { weight: 0.79, values: ["ALOT"] },
        ] }),
        deliveryMin: f.int({ minValue: 1, maxValue: 3 }),
        deliveryMax: f.int({ minValue: 3, maxValue: 12 }),
      },
    },
  }));
  const refinements = await tx.select({
    stock: offerRefinements.stock,
    deliveryMin: offerRefinements.deliveryMin,
    deliveryMax: offerRefinements.deliveryMax,
  }).from(offerRefinements).orderBy(offerRefinements.ordinal);

  if (refinements.length !== rows.length) {
    throw new Error("Drizzle Seed returned an unexpected offer refinement count");
  }

  return rows.map((row, index) => ({ ...row, ...refinements[index] }));
}

export async function seedCatalog(db: SeedDatabase, dataset: Dataset, { offerSeed }: { offerSeed?: number } = {}) {
  const productRows = dataset.products.map(({ variants: _, ...product }, position) => ({
    ...product,
    position,
  }));
  const variantRows = dataset.products.flatMap((product) =>
    product.variants.map(({ offers: _, ...variant }, position) => ({
      ...variant,
      position,
      productId: product.id,
    })),
  );
  const offerRows = dataset.products.flatMap((product) =>
    product.variants.flatMap((variant) =>
      variant.offers.map(({ currency: _, deliveryDays, ...offer }, position) => ({
        ...offer,
        deliveryMin: deliveryDays.min,
        deliveryMax: deliveryDays.max,
        position,
        variantId: variant.id,
      })),
    ),
  );

  await db.transaction(async (tx) => {
    const seededOffers = offerSeed === undefined || !offerRows.length
      ? offerRows
      : await refineOfferRows(tx, offerRows, offerSeed);

    await tx.execute(sql`lock table ${categories}, ${products}, ${variants}, ${offers},
      ${vendors}, ${warehouses}, ${vouchers} in share row exclusive mode`);
    await tx.delete(offers);
    await tx.delete(variants);
    await tx.delete(products);
    await tx.delete(vouchers);
    await tx.delete(categories);
    await tx.delete(vendors);
    await tx.delete(warehouses);

    if (dataset.categories.length) {
      await tx.insert(categories).values(dataset.categories.map((row, position) => ({ ...row, position })));
    }
    if (dataset.vendors.length) {
      await tx.insert(vendors).values(dataset.vendors.map((row, position) => ({ ...row, position })));
    }
    if (dataset.warehouses.length) {
      await tx.insert(warehouses).values(dataset.warehouses.map((row, position) => ({ ...row, position })));
    }
    if (productRows.length) await tx.insert(products).values(productRows);
    if (variantRows.length) await tx.insert(variants).values(variantRows);
    for (let start = 0; start < seededOffers.length; start += 1000) {
      await tx.insert(offers).values(seededOffers.slice(start, start + 1000));
    }
    if (dataset.vouchers.length) await tx.insert(vouchers).values(dataset.vouchers);
  });
}
