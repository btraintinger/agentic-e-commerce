CREATE TYPE "currency" AS ENUM('EUR');--> statement-breakpoint
CREATE TYPE "stock_level" AS ENUM('NO', 'LITTLE', 'ALOT');--> statement-breakpoint
CREATE TYPE "voucher_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY,
	"variant_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"price" integer NOT NULL,
	"currency" "currency" DEFAULT 'EUR'::"currency" NOT NULL,
	"shipping_cost" integer NOT NULL,
	"free_shipping_threshold" integer,
	"delivery_days_min" integer NOT NULL,
	"delivery_days_max" integer NOT NULL,
	"stock" "stock_level" NOT NULL,
	CONSTRAINT "offers_monetary_values_nonnegative" CHECK ("price" >= 0 and "shipping_cost" >= 0 and "free_shipping_threshold" >= 0),
	CONSTRAINT "offers_threshold_requires_paid_shipping" CHECK ("free_shipping_threshold" is null or "shipping_cost" > 0),
	CONSTRAINT "offers_delivery_days_range" CHECK ("delivery_days_min" >= 0 and "delivery_days_max" >= "delivery_days_min")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"brand" text,
	"tags" text[] NOT NULL,
	"attributes" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"attributes" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL,
	"rating" double precision NOT NULL,
	CONSTRAINT "vendors_rating_range" CHECK ("rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"code" text PRIMARY KEY,
	"type" "voucher_type" NOT NULL,
	"value" integer NOT NULL,
	"min_order_value" integer,
	"valid_until" date,
	"category_id" uuid,
	"description" text NOT NULL,
	CONSTRAINT "vouchers_values_nonnegative" CHECK ("value" >= 0 and "min_order_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"package_tax" integer,
	CONSTRAINT "warehouses_package_tax_nonnegative" CHECK ("package_tax" >= 0)
);
--> statement-breakpoint
CREATE INDEX "offers_variant_id_price_index" ON "offers" ("variant_id","price");--> statement-breakpoint
CREATE INDEX "offers_vendor_id_index" ON "offers" ("vendor_id");--> statement-breakpoint
CREATE INDEX "offers_warehouse_id_index" ON "offers" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "products_category_id_index" ON "products" ("category_id");--> statement-breakpoint
CREATE INDEX "variants_product_id_index" ON "variants" ("product_id");--> statement-breakpoint
CREATE INDEX "vouchers_category_id_index" ON "vouchers" ("category_id");--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_variant_id_variants_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id");--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id");--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id");