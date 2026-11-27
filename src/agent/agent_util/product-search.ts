/** Searches the product catalog via tRPC, 
 * retrying with single words if the full phrase finds nothing. */

import type { QueryClient } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { ShopRequest } from "@/agent/types";
import { toProductFilters, type ProductFilters } from "@/agent/agent_util/catalog";
import type { CatalogProduct } from "@/agent/types";
import type { AppRouter } from "@/server/api/root";

/** Talks to the product catalog: full phrase first, single words as fallback. */
export class ProductSearch {
  private readonly trpc: TRPCOptionsProxy<AppRouter>;
  private readonly queryClient: QueryClient;

  constructor(trpc: TRPCOptionsProxy<AppRouter>, queryClient: QueryClient) {
    this.trpc = trpc;
    this.queryClient = queryClient;
  }

  async find(product: string, request: ShopRequest): Promise<CatalogProduct[]> {
    const filters = toProductFilters(request);
    const exact = await this.fetch(filters, product);
    if (exact.length > 0) return exact;
    return this.fetchEachWord(filters, product);
  }

  private async fetchEachWord(filters: ProductFilters, product: string) {
    const lists = await Promise.all(
      searchWords(product).map((word) => this.fetch(filters, word)),
    );
    return mergeUnique(lists);
  }

  private fetch(filters: ProductFilters, q: string) {
    return this.queryClient.query(
      this.trpc.products.list.queryOptions({ ...filters, q }),
    );
  }
}

const searchWords = (product: string) => [
  ...new Set(
    product
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 3),
  ),
];

function mergeUnique(lists: CatalogProduct[][]): CatalogProduct[] {
  const seen = new Set<string>();
  const merged: CatalogProduct[] = [];
  for (const product of lists.flat()) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    merged.push(product);
  }
  return merged;
}
