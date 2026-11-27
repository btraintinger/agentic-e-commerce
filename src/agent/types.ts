import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/api/root";
import { z } from "zod";

export type CatalogProduct =
  inferRouterOutputs<AppRouter>["products"]["list"][number];
export type CatalogVariant = CatalogProduct["variants"][number];
export type CatalogOffer = CatalogVariant["offers"][number];

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
})
  .refine(
    (data) =>
      data.minPriceEur === null ||
      data.maxPriceEur === null ||
      data.minPriceEur < data.maxPriceEur,
    {
      message: "minPriceEur must be less than maxPriceEur",
      path: ["minPriceEur"],
    },
);

export type ShopRequest = z.infer<typeof shopRequestSchema>;

/** Anything the user can refer to by name: shown options and cart lines. */
export interface Named {
  name: string;
  variantName: string;
}

export interface ProductOption extends Named {
  number: number;
  productId: string;
  offerId: string;
  price: number;
}

export interface CartLine extends Named {
  offerId: string;
  price: number;
  quantity: number;
}

export interface CartControls {
  lines: () => CartLine[];
  add: (line: CartLine) => void;
  remove: (offerId: string) => void;
}

export interface ShopResponse {
  text: string;
  request?: ShopRequest;
  options?: ProductOption[];
}
