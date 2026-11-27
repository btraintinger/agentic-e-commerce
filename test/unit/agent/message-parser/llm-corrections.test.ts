import { expect, test } from "vitest";
import {
  extractGender,
  extractPriceRange,
  extractQuantity,
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
