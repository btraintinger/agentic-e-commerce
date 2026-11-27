import type { ShopRequest } from "@/agent/types";

export interface Turn {
  message: string;
  /** Fields the recognised request must contain (product compared case-insensitively). */
  expected: Partial<ShopRequest>;
  /** Pattern the agent's reply must match. */
  reply: RegExp;
}

/** One coherent shopping session: later turns refer to options shown earlier. */
export const conversation: Turn[] = [
  {
    message: "I need a cap for men",
    expected: { intent: "search", product: "cap", gender: "male" },
    reply: /found \d+ options? for “cap”/i,
  },
  {
    message: "Please add number 4 to the cart",
    expected: {
      intent: "add_to_cart",
      product: null,
      number: 4,
      quantity: null,
    },
    reply: /^Added 1 ×/,
  },
  {
    message: "I want a T-Shirt for women under 100€",
    expected: {
      intent: "search",
      product: "t-shirt",
      gender: "female",
      maxPriceEur: 100,
    },
    reply: /found \d+ options?/i,
  },
  {
    message: "I want 2 of number 2 added to the cart",
    expected: { intent: "add_to_cart", product: null, number: 2, quantity: 2 },
    reply: /^Added 2 ×/,
  },
  {
    message: "Please remove the T-Shirt from the cart",
    expected: { intent: "remove_from_cart", product: "t-shirt", number: null },
    reply: /^Removed/,
  },
  {
    message: "I need trousers for women that cost at least 50€",
    expected: {
      intent: "search",
      product: "trousers",
      gender: "female",
      minPriceEur: 50,
    },
    reply: /found \d+ options?/i,
  },
  {
    message: "Please add 3 of number 1",
    expected: { intent: "add_to_cart", product: null, number: 1, quantity: 3 },
    reply: /^Added 3 ×/,
  },
  {
    message: "Please remove the wool trousers from the cart",
    expected: {
      intent: "remove_from_cart",
      product: "wool trousers",
      number: null,
    },
    reply: /^Removed/,
  },
  {
    // Typo must be fixed; the cheapest seeded laptop costs more than 400€.
    // Known failure: Qwen 0.5B keeps "labtop" Should be saved through semantic search in the backend!!.
    message: "I want a labtop that costs between 150€ and 400€",
    expected: {
      intent: "search",
      product: "laptop",
      minPriceEur: 150,
      maxPriceEur: 400,
    },
    reply: /found no “laptop”/,
  },
];
