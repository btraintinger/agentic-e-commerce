import { relations } from "drizzle-orm";
import { index, pgEnum, pgTableCreator, primaryKey } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";
import type { Product, Variant } from "~/types";

export const createTable = pgTableCreator((name) => `webshop_${name}`);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
  ]
);

export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({
      mode: "date",
      withTimezone: true,
    })
    .$defaultFn(() => /* @__PURE__ */ new Date()),
  image: d.varchar({ length: 255 }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ]
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("t_user_id_idx").on(t.userId)]
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

export const stockLevel = pgEnum("webshop_stock_level", ["NO", "LITTLE", "ALOT"]);
export const voucherType = pgEnum("webshop_voucher_type", ["percent", "fixed"]);

export const categories = createTable("category", (d) => ({
  id: d.text().primaryKey(),
  name: d.text().notNull(),
  description: d.text().notNull(),
  position: d.integer().notNull(),
}));

export const products = createTable(
  "product",
  (d) => ({
    id: d.text().primaryKey(),
    categoryId: d.text().notNull().references(() => categories.id),
    name: d.text().notNull(),
    description: d.text().notNull(),
    brand: d.text(),
    tags: d.text().array().notNull(),
    attributes: d.jsonb().$type<Product["attributes"]>().notNull(),
    position: d.integer().notNull(),
  }),
  (t) => [index("product_category_idx").on(t.categoryId)],
);

export const variants = createTable(
  "variant",
  (d) => ({
    id: d.text().primaryKey(),
    productId: d.text().notNull().references(() => products.id),
    sku: d.text().notNull(),
    name: d.text().notNull(),
    attributes: d.jsonb().$type<Variant["attributes"]>().notNull(),
    position: d.integer().notNull(),
  }),
  (t) => [index("variant_product_idx").on(t.productId)],
);

export const vendors = createTable("vendor", (d) => ({
  id: d.text().primaryKey(),
  name: d.text().notNull(),
  rating: d.doublePrecision().notNull(),
  position: d.integer().notNull(),
}));

export const warehouses = createTable("warehouse", (d) => ({
  id: d.text().primaryKey(),
  name: d.text().notNull(),
  country: d.text().notNull(),
  packageTax: d.integer(),
  position: d.integer().notNull(),
}));

export const offers = createTable(
  "offer",
  (d) => ({
    id: d.text().primaryKey(),
    variantId: d.text().notNull().references(() => variants.id),
    vendorId: d.text().notNull().references(() => vendors.id),
    warehouseId: d.text().notNull().references(() => warehouses.id),
    price: d.integer().notNull(),
    shippingCost: d.integer().notNull(),
    freeShippingThreshold: d.integer(),
    deliveryMin: d.integer().notNull(),
    deliveryMax: d.integer().notNull(),
    stock: stockLevel().notNull(),
    position: d.integer().notNull(),
  }),
  (t) => [index("offer_variant_idx").on(t.variantId)],
);

export const vouchers = createTable("voucher", (d) => ({
  code: d.text().primaryKey(),
  type: voucherType().notNull(),
  value: d.doublePrecision().notNull(),
  minOrderValue: d.integer(),
  validUntil: d.text(),
  categoryId: d.text().references(() => categories.id),
  description: d.text().notNull(),
}));

export const productRelations = relations(products, ({ many }) => ({
  variants: many(variants),
}));

export const variantRelations = relations(variants, ({ one, many }) => ({
  product: one(products, { fields: [variants.productId], references: [products.id] }),
  offers: many(offers),
}));

export const offerRelations = relations(offers, ({ one }) => ({
  variant: one(variants, { fields: [offers.variantId], references: [variants.id] }),
}));
