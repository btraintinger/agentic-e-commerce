import { defineRelations } from "drizzle-orm";
import { offers, products, variants } from "@/server/db/schema";

export const relations = defineRelations(
  { offers, products, variants },
  (r) => ({
    products: {
      variants: r.many.variants({
        from: r.products.id,
        to: r.variants.productId,
      }),
    },
    variants: {
      offers: r.many.offers({ from: r.variants.id, to: r.offers.variantId }),
    },
  }),
);
