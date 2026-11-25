import type { QueryClient } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { LanguageModel } from "ai";
import { recognizeIntent, type Intent } from "@/agent/intent";
import type { AppRouter } from "@/server/api/root";

type CatalogProduct = inferRouterOutputs<AppRouter>["products"]["list"][number];
type CatalogVariant = CatalogProduct["variants"][number];
type CatalogOffer = CatalogVariant["offers"][number];
type Candidate = { variant: CatalogVariant; offer: CatalogOffer };

export interface ProductOption {
  number: number;
  productId: string;
  offerId: string;
  name: string;
  variantName: string;
  price: number;
}

export interface CartLine {
  offerId: string;
  name: string;
  variantName: string;
  price: number;
  quantity: number;
}

export interface CartControls {
  lines: () => CartLine[];
  add: (line: CartLine) => void;
  remove: (offerId: string) => void;
}

export interface AgentReply {
  text: string;
  intent?: Intent;
  options?: ProductOption[];
}

const maxOptions = 5;

export const offTopicReply =
  "I can only help you shop here. Try something like “Show me headphones under €50”.";
export const failureReply =
  "The product search failed. Please try again later.";
const retryReply = "Sorry, I did not get that. Could you please ask again?";

const toCents = (eur: number | null) =>
  eur === null ? undefined : Math.round(eur * 100);

export function toProductFilters(intent: Intent) {
  return {
    ...(intent.product ? { q: intent.product } : {}),
    ...(intent.minPriceEur === null
      ? {}
      : { minPrice: toCents(intent.minPriceEur) }),
    ...(intent.maxPriceEur === null
      ? {}
      : { maxPrice: toCents(intent.maxPriceEur) }),
  };
}

function matchesGender(variant: CatalogVariant, gender: Intent["gender"]) {
  const variantGender = variant.attributes.gender;
  return (
    gender === null ||
    variantGender === undefined ||
    variantGender === gender ||
    variantGender === "unisex"
  );
}

function cheapestOffer(
  product: CatalogProduct,
  intent: Intent,
): Candidate | undefined {
  const min = toCents(intent.minPriceEur) ?? 0;
  const max = toCents(intent.maxPriceEur) ?? Number.POSITIVE_INFINITY;
  return product.variants
    .filter((variant) => matchesGender(variant, intent.gender))
    .flatMap((variant) =>
      variant.offers
        .filter(
          (offer) =>
            offer.stock !== "NO" && offer.price >= min && offer.price <= max,
        )
        .map((offer) => ({ variant, offer })),
    )
    .sort((a, b) => a.offer.price - b.offer.price)[0];
}

function toOption(
  product: CatalogProduct,
  best: Candidate,
  number: number,
): ProductOption {
  return {
    number,
    productId: product.id,
    offerId: best.offer.id,
    name: product.name,
    variantName: best.variant.name,
    price: best.offer.price,
  };
}

export function toOptions(
  products: CatalogProduct[],
  intent: Intent,
): ProductOption[] {
  const options: ProductOption[] = [];
  for (const product of products) {
    const best = cheapestOffer(product, intent);
    if (!best) continue;
    options.push(toOption(product, best, options.length + 1));
    if (options.length === maxOptions) break;
  }
  return options;
}

const tokens = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const sameWord = (a: string, b: string) =>
  a === b || a + "s" === b || b + "s" === a || a + "es" === b || b + "es" === a;

const containsSequence = (haystack: string[], needle: string[]) =>
  needle.length > 0 &&
  haystack.some((_, start) =>
    needle.every((word, i) => {
      const other = haystack[start + i];
      return other !== undefined && sameWord(word, other);
    }),
  );

function topScoring<T>(
  items: T[],
  score: (item: T) => number,
  keepZero = false,
): T[] {
  let top = keepZero ? -1 : 0;
  let best: T[] = [];
  for (const item of items) {
    const value = score(item);
    if (value < top || (!keepZero && value === 0)) continue;
    if (value > top) {
      top = value;
      best = [];
    }
    best.push(item);
  }
  return best;
}

type Named = { name: string; variantName: string };

type Selection<T> =
  | { kind: "found"; item: T }
  | { kind: "ambiguous"; items: T[] }
  | { kind: "none" };

const countWordsIn = (words: string[], text: string) => {
  const haystack = tokens(text);
  return words.filter((word) => haystack.some((other) => sameWord(word, other)))
    .length;
};

const phraseMatches = <T extends Named>(items: T[], query: string[]) =>
  items.filter((item) => containsSequence(tokens(item.name), query));

const wordScoreMatches = <T extends Named>(items: T[], words: string[]) =>
  topScoring(items, (item) => countWordsIn(words, item.name));

const breakTieByVariant = <T extends Named>(best: T[], words: string[]) =>
  best.length > 1
    ? topScoring(best, (item) => countWordsIn(words, item.variantName), true)
    : best;

function pickByNumber<T>(
  items: T[],
  best: T[],
  number: number | null,
): T | undefined {
  const picked = number === null ? undefined : items[number - 1];
  return picked && best.includes(picked) ? picked : undefined;
}

export function selectByProduct<T extends Named>(
  items: T[],
  product: string,
  number: number | null,
): Selection<T> {
  const query = tokens(product);
  const words = [...new Set(query.filter((word) => word.length >= 3))];
  let best = phraseMatches(items, query);
  if (best.length === 0) best = wordScoreMatches(items, words);
  best = breakTieByVariant(best, words);
  if (best.length === 0) return { kind: "none" };
  if (best.length === 1 && best[0]) return { kind: "found", item: best[0] };
  const picked = pickByNumber(items, best, number);
  if (picked) return { kind: "found", item: picked };
  return { kind: "ambiguous", items: best };
}

const listNames = (items: Named[]) =>
  items.map((item) => `${item.name} (${item.variantName})`).join(", ");

type Picked<T> = { item: T } | { text: string };

function selectNamed<T extends Named>(
  items: T[],
  product: string,
  number: number | null,
  texts: { ambiguous: string; none: string },
): Picked<T> {
  const selection = selectByProduct(items, product, number);
  if (selection.kind === "found") return { item: selection.item };
  if (selection.kind === "ambiguous")
    return { text: `${texts.ambiguous}: ${listNames(selection.items)}?` };
  return { text: texts.none };
}

const numberedOrSingle = <T>(items: T[], number: number | null) =>
  (number === null ? undefined : items[number - 1]) ??
  (items.length === 1 ? items[0] : undefined);

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
  for (const list of lists)
    for (const product of list)
      if (!seen.has(product.id)) {
        seen.add(product.id);
        merged.push(product);
      }
  return merged;
}

function searchReply(intent: Intent, options: ProductOption[]): AgentReply {
  if (options.length === 0)
    return {
      intent,
      text: `Sorry, I found no “${intent.product}” that matches your request.`,
    };
  return {
    intent,
    options,
    text: `I found ${options.length} option${options.length === 1 ? "" : "s"} for “${intent.product}”. Which one would you like?`,
  };
}

const isModelReady = (
  model: LanguageModel | undefined,
): model is LanguageModel => Boolean(model);

const modelNotLoaded = (): AgentReply => ({
  text: "The language model is not loaded yet.",
});

const askToRephrase = (): AgentReply => ({ text: retryReply });

async function recognizeUserIntent(model: LanguageModel, message: string) {
  const start = performance.now();
  const intent = await recognizeIntent(model, message);
  console.debug(
    `Intent recognition took ${Math.round(performance.now() - start)} ms`,
  );
  return intent;
}

const rejectOffTopic = (intent: Intent): AgentReply => ({
  intent,
  text: offTopicReply,
});

export function createShoppingAgent(
  model: LanguageModel | undefined,
  trpc: TRPCOptionsProxy<AppRouter>,
  queryClient: QueryClient,
  cart?: CartControls,
) {
  let shown: ProductOption[] = [];

  const fetchProducts = (
    filters: ReturnType<typeof toProductFilters>,
    q: string,
  ) => queryClient.query(trpc.products.list.queryOptions({ ...filters, q }));

  async function searchWithFallback(intent: Intent & { product: string }) {
    const filters = toProductFilters(intent);
    const products = await fetchProducts(filters, intent.product);
    if (products.length > 0) return products;
    const lists: CatalogProduct[][] = [];
    for (const word of searchWords(intent.product))
      lists.push(await fetchProducts(filters, word));
    return mergeUnique(lists);
  }

  async function searchProducts(intent: Intent): Promise<AgentReply> {
    if (!intent.product)
      return { intent, text: "What kind of product are you looking for?" };
    const products = await searchWithFallback({
      ...intent,
      product: intent.product,
    });
    const options = toOptions(products, intent);
    shown = options;
    return searchReply(intent, options);
  }

  function addOption(option: ProductOption, quantity: number): string {
    cart?.add({
      offerId: option.offerId,
      name: option.name,
      variantName: option.variantName,
      price: option.price,
      quantity,
    });
    return `Added ${quantity} × ${option.name} (${option.variantName}) to your cart.`;
  }

  function pickShownOption(intent: Intent): Picked<ProductOption> {
    const product = intent.product?.trim();
    if (product && shown.length > 0)
      return selectNamed(shown, product, intent.number, {
        ambiguous: "Which one do you mean",
        none: `“${product}” is not among the options I showed you.`,
      });
    const option = numberedOrSingle(shown, intent.number);
    if (option) return { item: option };
    return {
      text:
        shown.length === 0
          ? "Please search for a product first, then pick an option."
          : `Which option do you mean? Please name a number from 1 to ${shown.length}.`,
    };
  }

  function addToCart(intent: Intent): AgentReply {
    const picked = pickShownOption(intent);
    if ("text" in picked) return { intent, text: picked.text };
    return { intent, text: addOption(picked.item, intent.quantity ?? 1) };
  }

  function pickCartLine(intent: Intent, lines: CartLine[]): Picked<CartLine> {
    const product = intent.product?.trim();
    if (product)
      return selectNamed(lines, product, intent.number, {
        ambiguous: "Which one should I remove",
        none: `I could not find “${product}” in your cart.`,
      });
    const line = numberedOrSingle(lines, intent.number);
    if (line) return { item: line };
    return {
      text: "Which item should I remove? Please name it or its position in the cart.",
    };
  }

  function removeFromCart(intent: Intent): AgentReply {
    const lines = cart?.lines() ?? [];
    if (lines.length === 0)
      return { intent, text: "Your cart is already empty." };
    const picked = pickCartLine(intent, lines);
    if ("text" in picked) return { intent, text: picked.text };
    cart?.remove(picked.item.offerId);
    return { intent, text: `Removed ${picked.item.name} from your cart.` };
  }

  async function execute(intent: Intent): Promise<AgentReply> {
    switch (intent.intent) {
      case "search":
        return searchProducts(intent);
      case "add_to_cart":
        return addToCart(intent);
      case "remove_from_cart":
        return removeFromCart(intent);
      case "off_topic":
        return rejectOffTopic(intent);
    }
  }

  async function performIntent(intent: Intent): Promise<AgentReply> {
    try {
      return await execute(intent);
    } catch (error) {
      console.error(error);
      return { intent, text: failureReply };
    }
  }

  async function agentLoop(message: string): Promise<AgentReply> {
    if (!isModelReady(model)) return modelNotLoaded();
    const intent = await recognizeUserIntent(model, message);
    if (!intent) return askToRephrase();
    return await performIntent(intent);
  }

  const handleMessage = (message: string) => agentLoop(message);

  return {
    handleMessage,
    execute,
    addOption: (option: ProductOption) => addOption(option, 1),
  };
}

export type ShoppingAgent = ReturnType<typeof createShoppingAgent>;
