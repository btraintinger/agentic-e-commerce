import type { Product } from "./types.js";

export function matchesProductSearch(product: Product, lowerQuery: string): boolean {
  return product.name.toLowerCase().includes(lowerQuery) ||
    product.description.toLowerCase().includes(lowerQuery) ||
    (product.brand ?? "").toLowerCase().includes(lowerQuery) ||
    product.tags.some((tag) => tag.toLowerCase().includes(lowerQuery));
}
