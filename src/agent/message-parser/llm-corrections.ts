import type { ShopRequest } from "@/agent/types";

// --- Deterministic field extraction -------------------------------------
// Small LLMs are unreliable with numbers and direction words ("at least" vs
// "under"), so prices, quantity and gender are read from the message itself.

const NUM = String.raw`(\d+(?:[.,]\d+)?)\s*(?:€|eur(?:o|os)?\b)?`;
const toNumber = (raw: string) => Number(raw.replace(",", "."));

const BETWEEN = new RegExp(
  String.raw`(?:between|betwen|betwwen|from)\s*€?\s*${NUM}\s*(?:and|to|-)\s*€?\s*${NUM}`,
  "i",
);
const RANGE = new RegExp(String.raw`€?\s*${NUM}\s*-\s*€?\s*${NUM}`, "i");
const MAX = new RegExp(
  String.raw`(?:under|below|less than|at most|max(?:imum)?|up to|cheaper than|no more than)\s*€?\s*${NUM}`,
  "i",
);
const MIN = new RegExp(
  String.raw`(?:over|above|more than|at least|min(?:imum)?|from|starting at|more expensive than)\s*€?\s*${NUM}`,
  "i",
);

export function extractPriceRange(message: string): {
  minPriceEur: number | null;
  maxPriceEur: number | null;
} {
  const range = BETWEEN.exec(message) ?? RANGE.exec(message);
  if (range) {
    const [a, b] = [toNumber(range[1]!), toNumber(range[2]!)];
    return { minPriceEur: Math.min(a, b), maxPriceEur: Math.max(a, b) };
  }
  const max = MAX.exec(message);
  const min = MIN.exec(message);
  let minPriceEur = min ? toNumber(min[1]!) : null;
  let maxPriceEur = max ? toNumber(max[1]!) : null;
  if (minPriceEur !== null && maxPriceEur !== null && minPriceEur > maxPriceEur) {
    [minPriceEur, maxPriceEur] = [maxPriceEur, minPriceEur];
  }
  return { minPriceEur, maxPriceEur };
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

export function extractQuantity(message: string): number | null {
  // Drop price numbers and option references ("number 1", "item 2", "no. 3").
  const cleaned = message
    .replace(/\d+(?:[.,]\d+)?\s*(?:€|eur(?:o|os)?\b)/gi, " ")
    .replace(/€\s*\d+(?:[.,]\d+)?/g, " ")
    .replace(/\b(?:number|no\.?|nr\.?|item|option|position|#)\s*\d+/gi, " ");
  const match =
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:x\b|of\b|pieces?\b|items?\b|[a-z-]{3,})/i.exec(
      cleaned,
    );
  if (!match) return null;
  const raw = match[1]!.toLowerCase();
  // "one" is mostly an article ("the second one", "one shirt") -> not a quantity.
  if (raw === "one") return null;
  const value = WORD_NUMBERS[raw] ?? Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function extractGender(message: string): ShopRequest["gender"] {
  const text = message.toLowerCase();
  if (/\bunisex\b/.test(text)) return "unisex";
  if (/\b(women|woman|female|ladies|lady|girls?|for her)\b/.test(text)) return "female";
  if (/\b(men|man|male|gentlemen|boys?|for him)\b/.test(text)) return "male";
  return null;
}

/** Overrides the LLM's numeric/gender guesses with what the message really says. */
export function applyLlmCorrections(
  request: ShopRequest,
  message: string,
): ShopRequest {
  return {
    ...request,
    ...extractPriceRange(message),
    quantity: extractQuantity(message),
    gender: extractGender(message),
  };
}

