import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { catalogIdInput, uuid } from "@/server/catalog/input";
import { vendors } from "@/server/db/schema";

export const vendorsRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) =>
    ctx.getDb().select().from(vendors).orderBy(asc(vendors.id)),
  ),
  byId: publicProcedure.input(catalogIdInput).query(async ({ ctx, input }) => {
    const [vendor] = uuid.safeParse(input.id).success
      ? await ctx.getDb().select().from(vendors).where(eq(vendors.id, input.id))
      : [];
    if (!vendor)
      throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
    return vendor;
  }),
});
