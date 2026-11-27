/** Finds the shown option(no1,no2...) or cart line(item in shopping cart) the user means, 
 * by product name or by position number. */

import type { Named } from "@/agent/types";

export type Selection<T> =
  | { kind: "found"; item: T }
  | { kind: "ambiguous"; items: T[] }
  | { kind: "none" };

export type Picked<T> = { item: T } | { text: string };

export interface PickTexts<T> {
  ambiguous: (items: T[]) => string;
  notFound: (product: string) => string;
  askPosition: string;
}

/**
 * Picks the item the user means: by name if one is given,
 * otherwise by position, otherwise the only item there is.
 */
export function pickItem<T extends Named>(
  items: T[],
  request: { product: string | null; number: number | null },
  texts: PickTexts<T>,
): Picked<T> {
  const product = request.product?.trim();
  if (product) {
    const selection = selectByProduct(items, product, request.number);
    // The model sometimes fills `product` with noise ("number"); a valid
    // position number still says which item is meant.
    const byNumber = positionOf(items, request.number);
    if (selection.kind === "none" && byNumber) return { item: byNumber };
    return toPicked(selection, {
      ambiguous: texts.ambiguous,
      none: texts.notFound(product),
    });
  }
  const item = pickByPositionOrOnly(items, request.number);
  return item ? { item } : { text: texts.askPosition };
}

/** Finds items by name; the number only breaks ties between equal matches. */
export function selectByProduct<T extends Named>(
  items: T[],
  product: string,
  number: number | null,
): Selection<T> {
  const query = tokens(product);
  const words = significantWords(query);
  const best = breakTieByVariant(matchByName(items, query, words), words);
  const [only] = best;
  if (best.length === 0) {return { kind: "none" }; }
  if (best.length === 1 && only) return { kind: "found", item: only };
  const picked = pickByNumber(items, best, number);
  return picked
    ? { kind: "found", item: picked }
    : { kind: "ambiguous", items: best };
}

// --- Steps of selectByProduct ----------------------------------------------

/** Exact phrase in the name wins; otherwise the most matching words. */
function matchByName<T extends Named>(
  items: T[],
  query: string[],
  words: string[],
): T[] {
  const phraseMatches = items.filter((item) =>
    containsSequence(tokens(item.name), query),
  );
  if (phraseMatches.length > 0) return phraseMatches;
  return topScoring(items, (item) => countWordsIn(words, item.name));
}

function breakTieByVariant<T extends Named>(best: T[], words: string[]): T[] {
  if (best.length <= 1) return best;
  return topScoring(
    best,
    (item) => countWordsIn(words, item.variantName),
    true,
  );
}

function pickByNumber<T>(
  items: T[],
  best: T[],
  number: number | null,
): T | undefined {
  const picked = positionOf(items, number);
  return picked && best.includes(picked) ? picked : undefined;
}

function pickByPositionOrOnly<T>(
  items: T[],
  number: number | null,
): T | undefined {
  const byPosition = positionOf(items, number);
  return byPosition ?? (items.length === 1 ? items[0] : undefined);
}

function positionOf<T>(items: T[], number: number | null): T | undefined {
  return number === null ? undefined : items[number - 1];
}

function toPicked<T>(
  selection: Selection<T>,
  texts: { ambiguous: (items: T[]) => string; none: string },
): Picked<T> {
  switch (selection.kind) {
    case "found":
      return { item: selection.item };
    case "ambiguous":
      return { text: texts.ambiguous(selection.items) };
    case "none":
      return { text: texts.none };
  }
}

// --- Text helpers ----------------------------------------------------------

const tokens = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const significantWords = (query: string[]) => [
  ...new Set(query.filter((word) => word.length >= 3)),
];

/** Equal, or equal up to a plural "s"/"es". */
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

const countWordsIn = (words: string[], text: string) => {
  const haystack = tokens(text);
  return words.filter((word) => haystack.some((other) => sameWord(word, other)))
    .length;
};

/** All items with the highest score; score 0 is dropped unless `keepZero`. */
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
