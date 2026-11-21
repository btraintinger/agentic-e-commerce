import { z } from "zod";

export const cartInput = z.object({
  items: z.array(z.object({ offerId: z.string(), quantity: z.int().min(1) })),
  voucherCode: z.string().optional(),
});
