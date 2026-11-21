import { asc } from "drizzle-orm";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { warehouses } from "@/server/db/schema";

export const warehousesRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx
      .getDb()
      .select()
      .from(warehouses)
      .orderBy(asc(warehouses.id));
    return rows.map(({ packageTax, ...warehouse }) => ({
      ...warehouse,
      ...(packageTax === null ? {} : { packageTax }),
    }));
  }),
});
