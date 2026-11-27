/**
 * Searches the product catalog for a shop request.
 *
 * Translates the request into the input of the `products.list` tRPC query
 * (product name as search text, price range in cents, because the catalog
 * stores prices in cents) and runs exactly one query. Finding similar products
 * (synonyms, word order, typos) is the job of the backend's semantic search.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { CatalogProduct, ShopRequest } from "@/agent/types";
import type { AppRouter } from "@/server/api/root";

/** Talks to the product catalog. */
export class ProductSearch {
  private readonly trpc: TRPCOptionsProxy<AppRouter>;
  private readonly queryClient: QueryClient;

  constructor(trpc: TRPCOptionsProxy<AppRouter>, queryClient: QueryClient) {
    this.trpc = trpc;
    this.queryClient = queryClient;
  }

  /** Returns all catalog products matching the product name and price range. */
  async find(product: string, request: ShopRequest): Promise<CatalogProduct[]> {
    // Price range from the request (in cents) plus the product name as search text.
    const priceFilters = this.toProductFilters(request);
    const searchInput = { ...priceFilters, q: product };

    // Build the tRPC query for `products.list` and run it.
    const query = this.trpc.products.list.queryOptions(searchInput);
    const products = await this.queryClient.query(query);

    return products;
  }

  /** Translates the shop request into query filters for `products.list`. */
  private toProductFilters(request: ShopRequest) {
    return {
      ...(request.product ? { q: request.product } : {}),
      ...(request.minPriceEur === null
        ? {}
        : { minPrice: this.toCents(request.minPriceEur) }),
      ...(request.maxPriceEur === null
        ? {}
        : { maxPrice: this.toCents(request.maxPriceEur) }),
    };
  }

  /** Converts euros to cents, because the catalog stores prices in cents. */
  private toCents(eur: number) {
    return Math.round(eur * 100);
  }
}
