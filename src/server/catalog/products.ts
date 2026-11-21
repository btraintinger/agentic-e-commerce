import { and, eq, exists, ilike, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { type productFilters, uuid } from "@/server/catalog/input";
import type { Database } from "@/server/db";
import { offers, variants } from "@/server/db/schema";

export async function listProducts(
  db: Database,
  filters: z.infer<typeof productFilters> = {},
  id?: string,
) {
  const { category, q, minPrice, maxPrice } = filters;
  if (
    (category && !uuid.safeParse(category).success) ||
    (id !== undefined && !uuid.safeParse(id).success)
  )
    return [];

  const rows = await db.query.products.findMany({
    where: {
      RAW: (product) => {
        const conditions: (SQL | undefined)[] = [];
        if (id !== undefined) conditions.push(eq(product.id, id));
        if (category) conditions.push(eq(product.categoryId, category));
        if (q) {
          const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
          conditions.push(
            or(
              ilike(sql`${product.name} collate pg_catalog.pg_c_utf8`, pattern),
              ilike(
                sql`${product.description} collate pg_catalog.pg_c_utf8`,
                pattern,
              ),
              ilike(
                sql`${product.brand} collate pg_catalog.pg_c_utf8`,
                pattern,
              ),
              sql`exists (select 1 from unnest(${product.tags}) as tag(value)
              where tag.value collate pg_catalog.pg_c_utf8 ilike ${pattern})`,
            ),
          );
        }
        if (minPrice !== undefined || maxPrice !== undefined) {
          conditions.push(
            exists(
              db
                .select({ id: offers.id })
                .from(offers)
                .innerJoin(variants, eq(offers.variantId, variants.id))
                .where(
                  and(
                    eq(variants.productId, product.id),
                    minPrice === undefined
                      ? undefined
                      : sql`${offers.price} >= ${minPrice}::bigint`,
                    maxPrice === undefined
                      ? undefined
                      : sql`${offers.price} <= ${maxPrice}::bigint`,
                  ),
                ),
            ),
          );
        }
        return and(...conditions) ?? sql`true`;
      },
    },
    orderBy: { id: "asc" },
    with: {
      variants: {
        columns: { productId: false },
        orderBy: { id: "asc" },
        with: {
          offers: { columns: { variantId: false }, orderBy: { id: "asc" } },
        },
      },
    },
  });

  return rows.map(({ brand, variants: productVariants, ...product }) => ({
    ...product,
    ...(brand === null ? {} : { brand }),
    variants: productVariants.map(({ offers: variantOffers, ...variant }) => ({
      ...variant,
      offers: variantOffers.map(
        ({
          deliveryDaysMin,
          deliveryDaysMax,
          freeShippingThreshold,
          ...offer
        }) => ({
          ...offer,
          deliveryDays: { min: deliveryDaysMin, max: deliveryDaysMax },
          ...(freeShippingThreshold === null ? {} : { freeShippingThreshold }),
        }),
      ),
    })),
  }));
}
