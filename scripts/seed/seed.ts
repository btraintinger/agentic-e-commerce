import { getColumns, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { seed } from "drizzle-seed";
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
import { buildCatalog, seedNumber } from "./catalog";

function updates(table: PgTable) {
  return Object.fromEntries(
    Object.entries(getColumns(table))
      .filter(([, column]) => !column.primary)
      .map(([key, column]) => [
        key,
        sql`excluded.${sql.identifier(column.name)}`,
      ]),
  );
}

export async function seedCatalog(db: Database) {
  const catalog = buildCatalog();
  const firstOffer = catalog.offers[0];
  const generated = await seed(
    db,
    { offers },
    { count: catalog.offers.length, seed: seedNumber, version: "4" },
  )
    .refine((values) => ({
      offers: {
        columns: {
          variantId: values.default({ defaultValue: firstOffer.variantId }),
          vendorId: values.default({ defaultValue: firstOffer.vendorId }),
          warehouseId: values.default({ defaultValue: firstOffer.warehouseId }),
          deliveryDaysMin: values.int({ minValue: 1, maxValue: 3 }),
          deliveryDaysMax: values.int({ minValue: 3, maxValue: 12 }),
          stock: values.valuesFromArray({
            values: [
              { weight: 0.08, values: ["NO"] },
              { weight: 0.13, values: ["LITTLE"] },
              { weight: 0.79, values: ["ALOT"] },
            ],
          }),
        },
      },
    }))
    .dryRun();

  const seededOffers = catalog.offers.map((draft, index) => {
    const { deliveryDaysMin, deliveryDaysMax, stock } = generated.offers[index];
    return { ...draft, deliveryDaysMin, deliveryDaysMax, stock };
  });

  await db.transaction(async (transaction) => {
    await transaction
      .insert(categories)
      .values(catalog.categories)
      .onConflictDoUpdate({ target: categories.id, set: updates(categories) });
    await transaction
      .insert(vendors)
      .values(catalog.vendors)
      .onConflictDoUpdate({ target: vendors.id, set: updates(vendors) });
    await transaction
      .insert(warehouses)
      .values(catalog.warehouses)
      .onConflictDoUpdate({ target: warehouses.id, set: updates(warehouses) });
    await transaction
      .insert(products)
      .values(catalog.products)
      .onConflictDoUpdate({ target: products.id, set: updates(products) });
    await transaction
      .insert(variants)
      .values(catalog.variants)
      .onConflictDoUpdate({ target: variants.id, set: updates(variants) });
    await transaction
      .insert(offers)
      .values(seededOffers)
      .onConflictDoUpdate({ target: offers.id, set: updates(offers) });
    await transaction
      .insert(vouchers)
      .values(catalog.vouchers)
      .onConflictDoUpdate({ target: vouchers.code, set: updates(vouchers) });
  });

  return {
    categories: catalog.categories.length,
    products: catalog.products.length,
    variants: catalog.variants.length,
    offers: seededOffers.length,
    vendors: catalog.vendors.length,
    warehouses: catalog.warehouses.length,
    vouchers: catalog.vouchers.length,
  };
}
