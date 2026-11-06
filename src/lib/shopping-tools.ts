import { createTRPCClient, httpLink, TRPCClientError } from "@trpc/client";
import { tool } from "ai";
import superjson from "superjson";
import { z } from "zod";

import type { AppRouter } from "~/server/api/root";
import type { Product } from "~/types";

const resultLimit = 4;
const priceInCents = z.number().int().nonnegative();

function productSummary({ id, name, brand, description }: Product) {
  return { id, name, brand, description };
}

function catalogError(error: unknown) {
  if (error instanceof TRPCClientError) {
    if (error.data?.code === "NOT_FOUND") {
      return new ShoppingError("That product is no longer in the catalog.");
    }
    if (error.data?.code === "TOO_MANY_REQUESTS") {
      return new ShoppingError("Too many cart checks. Wait a minute and try again.");
    }
  }
  return new ShoppingError("The shop could not complete this request. Try again shortly.");
}

export class ShoppingError extends Error {}

export function createShoppingTools() {
  const api = createTRPCClient<AppRouter>({
    links: [httpLink({ url: "/api/trpc", transformer: superjson })],
  });

  return {
    listCategories: tool({
      description: "List the shop's categories and their IDs for browsing.",
      inputSchema: z.object({}),
      execute: async (_, { abortSignal }) => {
        const categories = await api.categories.list.query(undefined, { signal: abortSignal })
          .catch((error: unknown) => { throw catalogError(error); });
        return { categories: categories.map(({ id, name }) => ({ id, name })) };
      },
    }),
    searchProducts: tool({
      description: "Find in-stock products and show product cards. Use a short literal search term or a category ID. Prices are EUR cents before shipping.",
      inputSchema: z.object({
        q: z.string().trim().min(1).max(100).optional().describe("One keyword, brand, or exact product name"),
        category: z.string().trim().min(1).max(120).optional().describe("A shop category ID from listCategories"),
        minPrice: priceInCents.optional().describe("Minimum price in EUR cents"),
        maxPrice: priceInCents.optional().describe("Maximum price in EUR cents"),
      }),
      execute: async (filters, { abortSignal }) => {
        const { minPrice, maxPrice } = filters;
        if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
          throw new ShoppingError("The minimum price must be at or below the maximum price.");
        }
        const products = await api.products.list.query(filters, { signal: abortSignal })
          .catch((error: unknown) => { throw catalogError(error); });
        const matches = products.flatMap((product) => {
          const offer = product.variants.flatMap(({ offers }) => offers)
            .filter(({ stock, price }) => stock !== "NO" &&
              price >= (minPrice ?? 0) && price <= (maxPrice ?? Infinity))
            .sort((a, b) => a.price - b.price)[0];
          return offer ? [{ ...productSummary(product), price: offer.price, stock: offer.stock }] : [];
        });
        matches.sort((a, b) => a.price - b.price);
        return { products: matches.slice(0, resultLimit), total: matches.length };
      },
    }),
    getOffers: tool({
      description: "Show offers with price, stock, shipping and delivery for a product ID from the catalog.",
      inputSchema: z.object({
        id: z.string().trim().min(1).max(150).describe("The exact catalog product ID"),
      }),
      execute: async ({ id }, { abortSignal }) => {
        const [product, vendors] = await Promise.all([
          api.products.byId.query({ id }, { signal: abortSignal }),
          api.vendors.list.query(undefined, { signal: abortSignal }),
        ]).catch((error: unknown) => { throw catalogError(error); });
        const vendorNames = new Map(vendors.map(({ id, name }) => [id, name]));
        const offers = product.variants.flatMap(({ name, offers }) =>
          offers.map(({ vendorId, warehouseId, currency, ...offer }) => ({
            ...offer,
            variant: name,
            vendor: vendorNames.get(vendorId) ?? vendorId,
          })),
        );
        offers.sort((a, b) => Number(a.stock === "NO") - Number(b.stock === "NO") || a.price - b.price);
        return { product: productSummary(product), offers: offers.slice(0, resultLimit) };
      },
    }),
    validateCart: tool({
      description: "Check availability and get final totals including package taxes, shipping, and any user-supplied voucher. No order is placed. Use when the shopper requests a cart check and the exact offer IDs and quantities are known.",
      inputSchema: z.object({
        items: z.array(z.object({
          offerId: z.string().trim().min(1).max(150),
          quantity: z.number().int().positive(),
        })).min(1).max(8),
        voucherCode: z.string().trim().min(1).max(100).optional(),
      }),
      execute: async (cart, { abortSignal }) => {
        const { valid, issues, totals, deliveryDays, packageCount } = await api.cart.validate
          .mutate(cart, { signal: abortSignal })
          .catch((error: unknown) => { throw catalogError(error); });
        return { valid, issues, totals, deliveryDays, packageCount };
      },
    }),
    askQuestion: tool({
      description: "Ask one short question with distinct clickable replies when an important shopping preference is missing.",
      inputSchema: z.object({
        question: z.string().trim().min(1).max(200),
        options: z.array(z.string().trim().min(1).max(60)).min(2).max(4)
          .refine((options) => new Set(options.map((option) => option.toLowerCase())).size === options.length),
      }),
      execute: (question) => question,
    }),
  };
}
