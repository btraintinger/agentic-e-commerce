import { expect, test } from "vitest";
import { pickItem } from "@/agent/agent-util/matching";

const items = [
  { name: "Casual Sneakers Court", variantName: "EU 41" },
  { name: "Rain Jacket", variantName: "M" },
];
const texts = {
  ambiguous: () => "ambiguous",
  notFound: (product: string) => `not found: ${product}`,
  askPosition: "which one?",
};

test("falls back to the number when the product name matches nothing", () => {
  expect(pickItem(items, { product: "number", number: 1 }, texts)).toEqual({
    item: items[0],
  });
});

test("a wrong product without a number is not found", () => {
  expect(pickItem(items, { product: "number", number: null }, texts)).toEqual({
    text: "not found: number",
  });
});

test("a wrong product with an out-of-range number is not found", () => {
  expect(pickItem(items, { product: "number", number: 5 }, texts)).toEqual({
    text: "not found: number",
  });
});

test("a matching product still wins over the number", () => {
  expect(pickItem(items, { product: "jacket", number: 1 }, texts)).toEqual({
    item: items[1],
  });
});
