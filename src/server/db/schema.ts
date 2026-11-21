import { sql } from "drizzle-orm";
import {
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

export type CatalogAttributes = Record<string, string | number | boolean>;

export const stockLevel = pgEnum("stock_level", ["NO", "LITTLE", "ALOT"]);
export const currency = pgEnum("currency", ["EUR"]);
export const voucherType = pgEnum("voucher_type", ["percent", "fixed"]);

export const categories = pgTable("categories", {
  id: uuid().primaryKey(),
  name: text().notNull(),
  description: text().notNull(),
});

export const products = pgTable(
  "products",
  {
    id: uuid().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    name: text().notNull(),
    description: text().notNull(),
    brand: text(),
    tags: text().array().notNull(),
    attributes: jsonb().$type<CatalogAttributes>().notNull(),
  },
  (table) => [index().on(table.categoryId)],
);

export const variants = pgTable(
  "variants",
  {
    id: uuid().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    sku: text().notNull(),
    name: text().notNull(),
    attributes: jsonb().$type<CatalogAttributes>().notNull(),
  },
  (table) => [index().on(table.productId)],
);

export const vendors = pgTable(
  "vendors",
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    rating: doublePrecision().notNull(),
  },
  (table) => [
    check("vendors_rating_range", sql`${table.rating} between 1 and 5`),
  ],
);

export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    country: text().notNull(),
    packageTax: integer("package_tax"),
  },
  (table) => [
    check("warehouses_package_tax_nonnegative", sql`${table.packageTax} >= 0`),
  ],
);

export const offers = pgTable(
  "offers",
  {
    id: uuid().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    price: integer().notNull(),
    currency: currency().notNull().default("EUR"),
    shippingCost: integer("shipping_cost").notNull(),
    freeShippingThreshold: integer("free_shipping_threshold"),
    deliveryDaysMin: integer("delivery_days_min").notNull(),
    deliveryDaysMax: integer("delivery_days_max").notNull(),
    stock: stockLevel().notNull(),
  },
  (table) => [
    index().on(table.variantId, table.price),
    index().on(table.vendorId),
    index().on(table.warehouseId),
    check(
      "offers_monetary_values_nonnegative",
      sql`${table.price} >= 0 and ${table.shippingCost} >= 0 and ${table.freeShippingThreshold} >= 0`,
    ),
    check(
      "offers_threshold_requires_paid_shipping",
      sql`${table.freeShippingThreshold} is null or ${table.shippingCost} > 0`,
    ),
    check(
      "offers_delivery_days_range",
      sql`${table.deliveryDaysMin} >= 0 and ${table.deliveryDaysMax} >= ${table.deliveryDaysMin}`,
    ),
  ],
);

export const vouchers = pgTable(
  "vouchers",
  {
    code: text().primaryKey(),
    type: voucherType().notNull(),
    value: integer().notNull(),
    minOrderValue: integer("min_order_value"),
    validUntil: date("valid_until", { mode: "string" }),
    categoryId: uuid("category_id").references(() => categories.id),
    description: text().notNull(),
  },
  (table) => [
    index().on(table.categoryId),
    check(
      "vouchers_values_nonnegative",
      sql`${table.value} >= 0 and ${table.minOrderValue} >= 0`,
    ),
  ],
);
