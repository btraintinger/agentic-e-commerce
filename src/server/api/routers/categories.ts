import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { catalogIdInput, uuid } from "@/server/catalog/input";
import { listProducts } from "@/server/catalog/products";
import { categories } from "@/server/db/schema";

export const categoriesRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) =>
    ctx.getDb().select().from(categories).orderBy(asc(categories.id)),
  ),
  products: publicProcedure
    .input(catalogIdInput)
    .query(async ({ ctx, input }) => {
      const db = ctx.getDb();
      const [category] = uuid.safeParse(input.id).success
        ? await db
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.id, input.id))
        : [];
      if (!category)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      return listProducts(db, { category: category.id });
    }),
});
