import { z } from "zod";
import type { Dataset } from "./types.js";

const deliveryDaysSchema = z.object({
  min: z.number().int().min(0),
  max: z.number().int().min(0),
});

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

const vendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  rating: z.number().min(1).max(5),
});

const warehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  packageTax: z.number().int().nonnegative().optional(),
});

const voucherSchema = z.object({
  code: z.string(),
  type: z.enum(["percent", "fixed"]),
  value: z.number(),
  minOrderValue: z.number().optional(),
  validUntil: z.string().optional(),
  categoryId: z.string().optional(),
  description: z.string(),
});

const offerSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  warehouseId: z.string(),
  price: z.number().int(),
  currency: z.literal("EUR"),
  shippingCost: z.number().int(),
  freeShippingThreshold: z.number().int().optional(),
  deliveryDays: deliveryDaysSchema,
  stock: z.enum(["NO", "LITTLE", "ALOT"]),
});

const variantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  offers: z.array(offerSchema),
});

const productSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: z.string(),
  description: z.string(),
  brand: z.string().optional(),
  tags: z.array(z.string()),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  variants: z.array(variantSchema),
});

const datasetSchema = z.object({
  categories: z.array(categorySchema),
  products: z.array(productSchema),
  vendors: z.array(vendorSchema),
  warehouses: z.array(warehouseSchema),
  vouchers: z.array(voucherSchema),
});

export function parseDataset(input: unknown): Dataset {
  const result = datasetSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Dataset validation failed: ${result.error.message}`,
    );
  }
  return result.data;
}
