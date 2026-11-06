import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { limitCartValidation } from "~/server/api/cart-rate-limit";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  findProduct, findVendor, listCategories, listCategoryProducts, listProducts,
  listVendors, listWarehouses, validateCatalogCart,
} from "~/server/db/catalog";

const byId = z.object({ id: z.string() });
const productFilters = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
  minPrice: z.number().int().optional(),
  maxPrice: z.number().int().optional(),
}).optional();

function notFound(resource: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message: `${resource} not found` });
}

const categoryRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => listCategories(ctx.db)),
  products: publicProcedure.input(byId).query(async ({ ctx, input }) => (
    await listCategoryProducts(ctx.db, input.id) ?? notFound("Category")
  )),
});

const productRouter = createTRPCRouter({
  list: publicProcedure.input(productFilters).query(({ ctx, input }) => listProducts(ctx.db, input ?? {})),
  byId: publicProcedure.input(byId).query(async ({ ctx, input }) => (
    await findProduct(ctx.db, input.id) ?? notFound("Product")
  )),
});

const vendorRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => listVendors(ctx.db)),
  byId: publicProcedure.input(byId).query(async ({ ctx, input }) => (
    await findVendor(ctx.db, input.id) ?? notFound("Vendor")
  )),
});

const warehouseRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => listWarehouses(ctx.db)),
});

const cartRouter = createTRPCRouter({
  validate: publicProcedure
    .use(({ ctx, next }) => {
      limitCartValidation(ctx.rateLimitKey);
      return next();
    })
    .input(z.object({
      items: z.array(z.object({ offerId: z.string(), quantity: z.number() })),
      voucherCode: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => validateCatalogCart(ctx.db, input)),
});

export const webshopProcedures = {
  health: publicProcedure.query(() => ({ status: "ok" as const })),
  categories: categoryRouter,
  products: productRouter,
  vendors: vendorRouter,
  warehouses: warehouseRouter,
  cart: cartRouter,
};
