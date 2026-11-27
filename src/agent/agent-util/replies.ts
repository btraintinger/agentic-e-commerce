/** All texts the agent replies to the user with. */

import type { CartLine, Named, ProductOption } from "@/agent/types";

export const offTopicReply =
  "I can only help you shop here. Try something like “Show me headphones under €50”.";
export const failureReply =
  "The product search failed. Please try again later.";

const listNames = (items: Named[]) =>
  items.map((item) => `${item.name} (${item.variantName})`).join(", ");

const plural = (count: number) => (count === 1 ? "" : "s");

/** Every text the agent says to the user, in one place. */
export const replies = {
  offTopic: offTopicReply,
  failure: failureReply,
  retry: "Sorry, I did not get that. Could you please ask again?",
  modelNotLoaded: "The language model is not loaded yet.",

  askForProduct: "What kind of product are you looking for?",
  noResults: (product: string) =>
    `Sorry, I found no “${product}” that matches your request.`,
  foundOptions: (count: number, product: string) =>
    `I found ${count} option${plural(count)} for “${product}”. Which one would you like?`,

  searchFirst: "Please search for a product first, then pick an option.",
  askOptionNumber: (count: number) =>
    `Which option do you mean? Please name a number from 1 to ${count}.`,
  ambiguousOption: (items: Named[]) =>
    `Which one do you mean: ${listNames(items)}?`,
  notAmongOptions: (product: string) =>
    `“${product}” is not among the options I showed you.`,
  added: (option: ProductOption, quantity: number) =>
    `Added ${quantity} × ${option.name} (${option.variantName}) to your cart.`,

  cartEmpty: "Your cart is already empty.",
  askCartLine:
    "Which item should I remove? Please name it or its position in the cart.",
  ambiguousCartLine: (items: Named[]) =>
    `Which one should I remove: ${listNames(items)}?`,
  notInCart: (product: string) => `I could not find “${product}” in your cart.`,
  removed: (line: CartLine) => `Removed ${line.name} from your cart.`,
} as const;
