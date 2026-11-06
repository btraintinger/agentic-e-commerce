import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { Dataset } from "~/types";
import {
  categories, offers, products, variants, vendors, vouchers, warehouses,
} from "./schema";

type SeedDatabase = ReturnType<typeof drizzle>;

export async function seedCatalog(db: SeedDatabase, dataset: Dataset) {
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
    for (let start = 0; start < offerRows.length; start += 1000) {
      await tx.insert(offers).values(offerRows.slice(start, start + 1000));
    }
    if (dataset.vouchers.length) await tx.insert(vouchers).values(dataset.vouchers);
  });
}
