import { expect, test } from "vitest";
import type { ShopRequest } from "@/agent/types";
import {
  applyLlmCorrections,
  correctNumber,
  extractGender,
  extractPriceRange,
  extractQuantity,
  sanitizeProduct,
} from "@/agent/message-parser/llm-corrections";

test.each([
  ["I want a t-shirt betwwen 50€ and 100€ added to my cart", 50, 100],
  ["I want a T-Shirt that costs at least 100€", 100, null],
  ["2 hoodies under 40 euro", null, 40],
  ["jacket 80-120€", 80, 120],
  ["I want trousers", null, null],
])("price range of %s", (message, minPriceEur, maxPriceEur) => {
  expect(extractPriceRange(message)).toEqual({ minPriceEur, maxPriceEur });
});

test.each([
  ["I want a t-shirt betwwen 50€ and 100€ added to my cart", null],
  ["2 hoodies under 40 euro", 2],
  ["Add 3 of number 1 to my cart", 3],
  ["I'll take the second one", null],
  ["Please add number 1", null],
  ["I want two caps", 2],
])("quantity of %s", (message, quantity) => {
  expect(extractQuantity(message)).toBe(quantity);
});

test.each([
  ["I want a t-shirt betwwen 50€ and 100€", null],
  ["trousers for women", "female"],
  ["a jacket for men", "male"],
  ["unisex hoodie", "unisex"],
])("gender of %s", (message, gender) => {
  expect(extractGender(message)).toBe(gender);
});

const req = (fields: Partial<ShopRequest>): ShopRequest => ({
  intent: "add_to_cart",
  product: null,
  gender: null,
  quantity: null,
  minPriceEur: null,
  maxPriceEur: null,
  number: null,
  ...fields,
});

test.each([
  ["number", null],
  ["number 2", null],
  ["No. 3", null],
  ["second one", null],
  ["jacket", "jacket"],
  ["jacket number 2", "jacket"],
])("cart action product %s -> %s", (product, expected) => {
  const message = "Put the jacket number 2 in my cart";
  expect(sanitizeProduct(req({ product }), message)).toBe(expected);
  expect(
    sanitizeProduct(req({ intent: "remove_from_cart", product }), message),
  ).toBe(expected);
});

test("cart action drops a product the message never names", () => {
  expect(
    sanitizeProduct(req({ product: "jacket" }), "Please add 3 of number 1"),
  ).toBeNull();
  expect(
    sanitizeProduct(
      req({ intent: "remove_from_cart", product: "wool trousers" }),
      "Please remove the wool trousers from the cart",
    ),
  ).toBe("wool trousers");
});

test.each([
  ["Please remove the T-Shirt from the cart", 1, null],
  ["I'll take the second one", 2, 2],
  ["Add number 3", null, 3],
])("number for %s (LLM %s) -> %s", (message, number, expected) => {
  expect(correctNumber(req({ number }), message)).toBe(expected);
});

test("search keeps the product untouched", () => {
  expect(
    sanitizeProduct(req({ intent: "search", product: "number 2" }), "x"),
  ).toBe("number 2");
});

test("corrections drop 'number' from product and keep the option number", () => {
  const corrected = applyLlmCorrections(
    req({ product: "number", number: 4 }),
    "Please add number 4 to the cart",
  );
  expect(corrected).toMatchObject({ product: null, number: 4, quantity: null });
});

test("corrections fill a missing option number from the message", () => {
  expect(
    applyLlmCorrections(
      req({ product: "number 2" }),
      "I want 2 of number 2 added to the cart",
    ),
  ).toMatchObject({ product: null, number: 2, quantity: 2 });
});
