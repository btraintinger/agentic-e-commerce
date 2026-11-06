import { and, EmptyFilter, sql, type RelationsFilter, type SQL, type SQLWrapper } from "drizzle-orm";

import { matchesProductSearch } from "~/product-search";
import type { Offer, Product, ValidateRequest, Warehouse } from "~/types";
import { validateCart } from "~/validate";
import type { db } from "./index";
import type { relations } from "./relations";
import type { offers, warehouses } from "./schema";

type Database = typeof db;
type Reader = Pick<Database, "query">;
type ProductWhere = RelationsFilter<(typeof relations)["products"], typeof relations>;
type OfferWhere = { RAW: (table: typeof offers) => SQL | typeof EmptyFilter };

type ProductFilters = {
  category?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
};

function isUnrepresentableText(value: string) {
  return /[\u0000\uD800-\uDFFF]/u.test(value);
}

function inTextSet(column: SQLWrapper, values: string[]) {
  return sql`${column} in (select jsonb_array_elements_text(${sql.param(values)}::jsonb))`;
}

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

function productsWithVariants(reader: Reader, where: ProductWhere, offerWhere?: OfferWhere) {
  return reader.query.products.findMany({
    where,
    columns: { position: false },
    orderBy: { position: "asc" },
    with: {
      variants: {
        where: offerWhere ? { offers: offerWhere } : EmptyFilter,
        columns: { productId: false, position: false },
        orderBy: { position: "asc" },
        with: {
          offers: { where: offerWhere ?? EmptyFilter, orderBy: { position: "asc" } },
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

export function listCategories(reader: Reader) {
  return reader.query.categories.findMany({
    columns: { position: false },
    orderBy: { position: "asc" },
  });
}

export function listCategoryProducts(database: Database, id: string) {
  if (isUnrepresentableText(id)) return undefined;
  return database.transaction(async (tx) => {
    const category = await tx.query.categories.findFirst({
      where: { id },
      columns: { id: true },
    });
    if (!category) return undefined;
    return productsWithVariants(tx, { categoryId: id });
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function listProducts(reader: Reader, { category, q, minPrice, maxPrice }: ProductFilters): Promise<Product[]> {
  if ((category && isUnrepresentableText(category)) || (q && isUnrepresentableText(q))) return [];
  const priceMatch: OfferWhere = {
    RAW: (table) => and(
      minPrice === undefined ? undefined : sql`${table.price} >= ${minPrice}::numeric`,
      maxPrice === undefined ? undefined : sql`${table.price} <= ${maxPrice}::numeric`,
    ) ?? EmptyFilter,
  };

  const matchingProducts = await productsWithVariants(reader, {
    ...(category ? { categoryId: category } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined ? { variants: { offers: priceMatch } } : {}),
  });
  const lowerQuery = q?.toLowerCase();
  return lowerQuery
    ? matchingProducts.filter((product) => matchesProductSearch(product, lowerQuery))
    : matchingProducts;
}

export async function findProduct(reader: Reader, id: string) {
  if (isUnrepresentableText(id)) return undefined;
  const [product] = await productsWithVariants(reader, { id });
  return product;
}

export function listVendors(reader: Reader) {
  return reader.query.vendors.findMany({
    columns: { position: false },
    orderBy: { position: "asc" },
  });
}

export function findVendor(reader: Reader, id: string) {
  if (isUnrepresentableText(id)) return undefined;
  return reader.query.vendors.findFirst({
    where: { id },
    columns: { position: false },
  });
}

export async function listWarehouses(reader: Reader) {
  const rows = await reader.query.warehouses.findMany({ orderBy: { position: "asc" } });
  return rows.map(toWarehouse);
}

export async function validateCatalogCart(database: Database, input: ValidateRequest) {
  return database.transaction(async (tx) => {
    const offerIds = [...new Set(input.items.map(({ offerId }) => offerId))]
      .filter((id) => !isUnrepresentableText(id));
    const offerWhere: OfferWhere = { RAW: (table) => inTextSet(table.id, offerIds) };
    const cartProducts = offerIds.length
      ? await productsWithVariants(tx, { variants: { offers: offerWhere } }, offerWhere)
      : [];
    const warehouseIds = [...new Set(cartProducts.flatMap(({ variants }) =>
      variants.flatMap(({ offers }) => offers.map(({ warehouseId }) => warehouseId)),
    ))];
    const cartWarehouses = warehouseIds.length
      ? await tx.query.warehouses.findMany({ where: { RAW: (table) => inTextSet(table.id, warehouseIds) } })
      : [];
    const voucher = input.voucherCode && !isUnrepresentableText(input.voucherCode)
      ? await tx.query.vouchers.findFirst({ where: { code: input.voucherCode } })
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
