import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { cartInput } from "@/server/cart/input";
import { validateCart } from "@/server/cart/validate";
import {
  offers,
  products,
  variants,
  vouchers,
  warehouses,
} from "@/server/db/schema";
import { enforceCartRateLimit } from "@/server/api/rate-limit";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

const uuid = z.uuid();
const rateLimitedProcedure = publicProcedure.use(({ ctx, next }) => {
  enforceCartRateLimit(ctx.headers);
  return next();
});

export const cartRouter = createTRPCRouter({
  validate: rateLimitedProcedure
    .input(cartInput)
    .mutation(async ({ ctx, input }) => {
      const offerIds = [
        ...new Set(
          input.items
            .map(({ offerId }) => offerId.toLowerCase())
            .filter((offerId) => uuid.safeParse(offerId).success),
        ),
      ];

      const db = offerIds.length > 0 || input.voucherCode ? ctx.getDb() : null;
      const [cartOffers, [voucher]] = await Promise.all([
        db && offerIds.length > 0
          ? db
              .select({
                offer: offers,
                productId: products.id,
                productName: products.name,
                categoryId: products.categoryId,
                variantId: variants.id,
                variantName: variants.name,
                packageTax: warehouses.packageTax,
              })
              .from(offers)
              .innerJoin(variants, eq(offers.variantId, variants.id))
              .innerJoin(products, eq(variants.productId, products.id))
              .innerJoin(warehouses, eq(offers.warehouseId, warehouses.id))
              .where(inArray(offers.id, offerIds))
          : [],
        db && input.voucherCode
          ? db
              .select()
              .from(vouchers)
              .where(eq(vouchers.code, input.voucherCode))
          : [],
      ]);

      return validateCart(input, cartOffers, voucher, new Date());
    }),
});
