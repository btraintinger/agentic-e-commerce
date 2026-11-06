import { and, asc, eq, inArray, or, sql, type SQL } from "drizzle-orm";

import type { Offer, Product, ValidateRequest, Warehouse } from "~/types";
import { validateCart } from "~/validate";
import type { db } from "./index";
import { categories, offers, products, variants, vendors, vouchers, warehouses } from "./schema";

type Database = typeof db;
type Reader = Pick<Database, "query" | "select">;

type ProductFilters = {
  category?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
};

function toWarehouse({ position: _, packageTax, ...warehouse }: typeof warehouses.$inferSelect): Warehouse {
  return { ...warehouse, ...(packageTax === null ? {} : { packageTax }) };
}

function toOffer({
  variantId: _, position: _position, freeShippingThreshold, deliveryMin, deliveryMax, ...offer
}: typeof offers.$inferSelect): Offer {
  return {
    ...offer,
    currency: "EUR",
    deliveryDays: { min: deliveryMin, max: deliveryMax },
    ...(freeShippingThreshold === null ? {} : { freeShippingThreshold }),
  };
}

function productsWithVariants(reader: Reader, where?: SQL, offerWhere?: SQL) {
  return reader.query.products.findMany({
    where,
    columns: { position: false },
    orderBy: asc(products.position),
    with: {
      variants: {
        where: offerWhere && inArray(variants.id, reader.select({ id: offers.variantId })
          .from(offers).where(offerWhere)),
        columns: { productId: false, position: false },
        orderBy: asc(variants.position),
        with: {
          offers: { where: offerWhere, orderBy: asc(offers.position) },
        },
      },
    },
  }).then((rows): Product[] => rows.map(({ brand, variants, ...product }) => ({
    ...product,
    ...(brand === null ? {} : { brand }),
    variants: variants.map(({ offers, ...variant }) => ({
      ...variant,
      offers: offers.map(toOffer),
    })),
  })));
}

function hasOffer(reader: Reader, where: SQL) {
  return inArray(products.id, reader.select({ id: variants.productId }).from(offers)
    .innerJoin(variants, eq(variants.id, offers.variantId)).where(where));
}

export function listCategories(reader: Reader) {
  return reader.query.categories.findMany({
    columns: { position: false },
    orderBy: asc(categories.position),
  });
}

export function listCategoryProducts(database: Database, id: string) {
  return database.transaction(async (tx) => {
    const category = await tx.query.categories.findFirst({
      where: eq(categories.id, id),
      columns: { id: true },
    });
    if (!category) return undefined;
    return listProducts(tx, { category: id });
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export function listProducts(reader: Reader, { category, q, minPrice, maxPrice }: ProductFilters) {
  const search = q?.toLowerCase();
  const textMatch = search ? or(
    sql`strpos(lower(${products.name}), ${search}) > 0`,
    sql`strpos(lower(${products.description}), ${search}) > 0`,
    sql`strpos(lower(${products.brand}), ${search}) > 0`,
    sql`exists (select 1 from unnest(${products.tags}) as tag where strpos(lower(tag), ${search}) > 0)`,
  ) : undefined;
  const priceMatch = and(
    minPrice === undefined ? undefined : sql`${offers.price} >= ${minPrice}::numeric`,
    maxPrice === undefined ? undefined : sql`${offers.price} <= ${maxPrice}::numeric`,
  );

  return productsWithVariants(reader, and(
    category ? eq(products.categoryId, category) : undefined,
    textMatch,
    priceMatch ? hasOffer(reader, priceMatch) : undefined,
  ));
}

export async function findProduct(reader: Reader, id: string) {
  const [product] = await productsWithVariants(reader, eq(products.id, id));
  return product;
}

export function listVendors(reader: Reader) {
  return reader.query.vendors.findMany({
    columns: { position: false },
    orderBy: asc(vendors.position),
  });
}

export function findVendor(reader: Reader, id: string) {
  return reader.query.vendors.findFirst({
    where: eq(vendors.id, id),
    columns: { position: false },
  });
}

export async function listWarehouses(reader: Reader) {
  const rows = await reader.query.warehouses.findMany({ orderBy: asc(warehouses.position) });
  return rows.map(toWarehouse);
}

export async function validateCatalogCart(database: Database, input: ValidateRequest) {
  return database.transaction(async (tx) => {
    const offerIds = [...new Set(input.items.map(({ offerId }) => offerId))];
    const offerWhere = inArray(offers.id, offerIds);
    const cartProducts = offerIds.length
      ? await productsWithVariants(tx, hasOffer(tx, offerWhere), offerWhere)
      : [];
    const warehouseIds = [...new Set(cartProducts.flatMap(({ variants }) =>
      variants.flatMap(({ offers }) => offers.map(({ warehouseId }) => warehouseId)),
    ))];
    const cartWarehouses = warehouseIds.length
      ? await tx.query.warehouses.findMany({ where: inArray(warehouses.id, warehouseIds) })
      : [];
    const voucher = input.voucherCode
      ? await tx.query.vouchers.findFirst({ where: eq(vouchers.code, input.voucherCode) })
      : undefined;

    return validateCart(input, {
      products: cartProducts,
      warehouses: cartWarehouses.map(toWarehouse),
      vouchers: voucher ? [{
        ...voucher,
        minOrderValue: voucher.minOrderValue ?? undefined,
        validUntil: voucher.validUntil ?? undefined,
        categoryId: voucher.categoryId ?? undefined,
      }] : [],
    });
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
