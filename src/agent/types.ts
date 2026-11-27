import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/api/root";
import type { z } from "zod";
import type { shopRequestSchema } from "@/agent/message-parser/shop-request-schema";

export type CatalogProduct =
  inferRouterOutputs<AppRouter>["products"]["list"][number];
export type CatalogVariant = CatalogProduct["variants"][number];
export type CatalogOffer = CatalogVariant["offers"][number];

/** The parsed chat message; its runtime schema lives in the message parser. */
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
