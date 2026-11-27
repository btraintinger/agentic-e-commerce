/** Runtime schema of a ShopRequest: the JSON shape the LLM must return.
 * Used for structured output and to validate the model's answer. */

import { z } from "zod";

export const intents = [
  "search",
  "add_to_cart",
  "remove_from_cart",
  "off_topic",
] as const;

export const genders = ["male", "female", "unisex"] as const;

export const shopRequestSchema = z.object({
  intent: z.enum(intents),
  product: z.string().nullable(),
  gender: z.enum(genders).nullable(),
  quantity: z.int().min(1).nullable(),
  maxPriceEur: z.number().min(0).nullable(),
  minPriceEur: z.number().min(0).nullable(),
  number: z.int().min(1).nullable(),
});
