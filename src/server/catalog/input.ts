import { z } from "zod";

export const catalogIdInput = z.object({ id: z.string() });
export const uuid = z.uuid();
export const productFilters = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
  minPrice: z.int().optional(),
  maxPrice: z.int().optional(),
});
