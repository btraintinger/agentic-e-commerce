/**
 * Turns the products found by the search into what the user gets to choose from.
 *
 * For every product it picks the cheapest offer that is in stock, inside the
 * requested price range and fits the requested gender. Products without such
 * an offer are skipped. The first 5 hits are numbered 1..5, so the user can
 * answer "I'll take number 2".
 */

import type {
  CatalogOffer,
  CatalogProduct,
  CatalogVariant,
  ProductOption,
  ShopRequest,
} from "@/agent/types";

const maxOptions = 5;

/** Converts euros to cents; `null` (no limit given) stays undefined. */
const toCents = (eur: number | null) =>
  eur === null ? undefined : Math.round(eur * 100);

type Candidate = { variant: CatalogVariant; offer: CatalogOffer };

/** Turns the first products that have a fitting offer into numbered options. */
export function toOptions(
  products: CatalogProduct[],
  request: ShopRequest,
): ProductOption[] {
  const options: ProductOption[] = [];
  for (const product of products) {
    const best = cheapestFittingOffer(product, request);
    if (!best) continue;
    options.push(toOption(product, best, options.length + 1));
    if (options.length === maxOptions) break;
  }
  return options;
}

function cheapestFittingOffer(
  product: CatalogProduct,
  request: ShopRequest,
): Candidate | undefined {
  const min = toCents(request.minPriceEur) ?? 0;
  const max = toCents(request.maxPriceEur) ?? Number.POSITIVE_INFINITY;
  const candidates = product.variants
    .filter((variant) => matchesGender(variant, request.gender))
    .flatMap((variant) =>
      variant.offers
        .filter((offer) => isBuyableWithin(offer, min, max))
        .map((offer) => ({ variant, offer })),
    );
  return candidates.sort((a, b) => a.offer.price - b.offer.price)[0];
}

function matchesGender(variant: CatalogVariant, gender: ShopRequest["gender"]) {
  const variantGender = variant.attributes.gender;
  return (
    gender === null ||
    variantGender === undefined ||
    variantGender === gender ||
    variantGender === "unisex"
  );
}

const isBuyableWithin = (offer: CatalogOffer, min: number, max: number) =>
  offer.stock !== "NO" && offer.price >= min && offer.price <= max;

function toOption(
  product: CatalogProduct,
  { variant, offer }: Candidate,
  number: number,
): ProductOption {
  return {
    number,
    productId: product.id,
    offerId: offer.id,
    name: product.name,
    variantName: variant.name,
    price: offer.price,
  };
}
