import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { catalogIdInput, productFilters } from "@/server/catalog/input";
import { listProducts } from "@/server/catalog/products";

export const productsRouter = createTRPCRouter({
  list: publicProcedure
    .input(productFilters.optional())
    .query(({ ctx, input }) => listProducts(ctx.getDb(), input)),
  byId: publicProcedure.input(catalogIdInput).query(async ({ ctx, input }) => {
    const [product] = await listProducts(ctx.getDb(), {}, input.id);
    if (!product)
      throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    return product;
  }),
});
