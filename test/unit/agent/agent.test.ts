import { expect, test, vi } from "vitest";
import { toOptions } from "@/agent/agent-util/product-options";
import { ProductSearch } from "@/agent/agent-util/product-search";
import { failureReply, offTopicReply } from "@/agent/agent-util/replies";
import { ShoppingAgent } from "@/agent/shopping-agent";
import { shopRequestSchema } from "@/agent/message-parser/shop-request-schema";
import type { CartLine, ShopRequest } from "@/agent/types";
import type * as ParseMessageModule from "@/agent/message-parser/parse-message";
import { createTestTRPCOptions } from "../../support/trpc-client";

vi.mock("server-only", () => ({}));

const { parseUserMessage } = vi.hoisted(() => ({
  parseUserMessage: vi.fn(),
}));
vi.mock("@/agent/message-parser/parse-message", async (importOriginal) => ({
  ...(await importOriginal<typeof ParseMessageModule>()),
  parseUserMessage,
}));

const createShoppingAgent = (
  ...args: ConstructorParameters<typeof ShoppingAgent>
) => new ShoppingAgent(...args);

const request = (fields: Partial<ShopRequest>): ShopRequest => ({
  intent: "search",
  product: null,
  gender: null,
  quantity: null,
  minPriceEur: null,
  maxPriceEur: null,
  number: null,
  ...fields,
});

const offer = (id: string, price: number, stock: "NO" | "LITTLE" | "ALOT") => ({
  id,
  vendorId: "v",
  warehouseId: "w",
  price,
  currency: "EUR" as const,
  shippingCost: 0,
  stock,
  deliveryDays: { min: 1, max: 2 },
});

const jacket = {
  id: "p1",
  categoryId: "c",
  name: "Rain Jacket",
  description: "",
  tags: [],
  attributes: {},
  variants: [
    {
      id: "v-f",
      sku: "f",
      name: "M / Red",
      attributes: { gender: "female" },
      offers: [offer("o-f", 9000, "ALOT")],
    },
    {
      id: "v-m",
      sku: "m",
      name: "M / Black",
      attributes: { gender: "male" },
      offers: [offer("o-m-out", 8000, "NO"), offer("o-m", 12000, "LITTLE")],
    },
  ],
};

function memoryCart() {
  let lines: CartLine[] = [];
  return {
    lines: () => lines,
    add: (line: CartLine) => {
      lines = [...lines, line];
    },
    remove: (offerId: string) => {
      lines = lines.filter((line) => line.offerId !== offerId);
    },
  };
}

test("creating the shopping agent leaves the query cache empty", () => {
  const { trpc, queryClient } = createTestTRPCOptions();

  createShoppingAgent(undefined, trpc, queryClient);

  expect(queryClient.getQueryCache().getAll()).toEqual([]);
});

test("the reply schema has the required fields and rejects other intents", () => {
  expect(Object.keys(shopRequestSchema.shape)).toEqual(
    expect.arrayContaining(["intent", "gender", "quantity", "maxPriceEur"]),
  );
  expect(
    shopRequestSchema.safeParse({ ...request({}), intent: "write_poem" }).success,
  ).toBe(false);
});

/** Runs ProductSearch.find and returns the input sent to `products.list`. */
async function searchInput(product: string, shopRequest: ShopRequest) {
  const { trpc, queryClient } = createTestTRPCOptions();
  const query = vi.spyOn(queryClient, "query").mockResolvedValue([]);
  await new ProductSearch(trpc, queryClient).find(product, shopRequest);
  const [options] = query.mock.calls[0]!;
  return (options.queryKey[1] as { input: unknown }).input;
}

test("search filters use euro cents", async () => {
  expect(
    await searchInput(
      "rain jacket",
      request({ product: "rain jacket", minPriceEur: 10, maxPriceEur: 150 }),
    ),
  ).toEqual({ q: "rain jacket", minPrice: 1000, maxPrice: 15000 });
});

test("options keep the cheapest in-stock offer of the requested gender", () => {
  const [option] = toOptions(
    [jacket],
    request({ product: "rain jacket", gender: "male", maxPriceEur: 150 }),
  );

  expect(option).toMatchObject({ number: 1, offerId: "o-m", price: 12000 });
});

test("off-topic messages never reach the backend or the cart", async () => {
  const { trpc, queryClient } = createTestTRPCOptions();
  const cart = memoryCart();
  const agent = createShoppingAgent(undefined, trpc, queryClient, cart);

  const reply = await agent.execute(request({ intent: "off_topic" }));

  expect(reply.text).toBe(offTopicReply);
  expect(cart.lines()).toEqual([]);
  expect(queryClient.getQueryCache().getAll()).toEqual([]);
});

test("adding and removing by number changes the cart", async () => {
  const { trpc, queryClient } = createTestTRPCOptions();
  const cart = memoryCart();
  const agent = createShoppingAgent(undefined, trpc, queryClient, cart);
  const [option] = toOptions([jacket], request({}));
  if (!option) throw new Error("expected an option");

  agent.addOption(option);
  await agent.execute(request({ intent: "remove_from_cart", number: 1 }));

  expect(cart.lines()).toEqual([]);
});

test("search sends one query with the full phrase and price filters", async () => {
  const { trpc, queryClient } = createTestTRPCOptions();
  const query = vi.spyOn(queryClient, "query").mockResolvedValueOnce([]);
  const agent = createShoppingAgent(undefined, trpc, queryClient);

  await agent.execute(request({ product: "a rain jacket", maxPriceEur: 150 }));

  const queries = query.mock.calls.map(([options]) => options.queryKey);
  expect(queries).toHaveLength(1);
  expect(queries[0]?.[1]).toEqual(
    expect.objectContaining({ input: { q: "a rain jacket", maxPrice: 15000 } }),
  );
});

test("a failing search returns a generic error message", async () => {
  const { trpc, queryClient } = createTestTRPCOptions();
  vi.spyOn(queryClient, "query").mockRejectedValue(new Error("down"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  parseUserMessage.mockResolvedValue(request({ product: "jacket" }));
  const model = {} as Parameters<typeof createShoppingAgent>[0];
  const agent = createShoppingAgent(model, trpc, queryClient);

  const reply = await agent.handleMessage("I need a jacket");

  expect(reply.text).toBe(failureReply);
});

const line = (offerId: string, name: string, variantName = "M"): CartLine => ({
  offerId,
  name,
  variantName,
  price: 1000,
  quantity: 1,
});

function cartWith(...lines: CartLine[]) {
  const cart = memoryCart();
  for (const item of lines) cart.add(item);
  const { trpc, queryClient } = createTestTRPCOptions();
  return {
    cart,
    agent: createShoppingAgent(undefined, trpc, queryClient, cart),
  };
}

test("removing prefers the named product over a wrong number", async () => {
  const { cart, agent } = cartWith(
    line("o1", "Rain Jacket"),
    line("o2", "Wool Socks"),
  );

  await agent.execute(
    request({ intent: "remove_from_cart", product: "socks", number: 1 }),
  );

  expect(cart.lines().map((item) => item.offerId)).toEqual(["o1"]);
});

test("removing matches singular and plural words", async () => {
  const { cart, agent } = cartWith(
    line("o1", "Rain Jacket"),
    line("o2", "Trail Shoe"),
  );

  await agent.execute(
    request({ intent: "remove_from_cart", product: "the trail shoes" }),
  );

  expect(cart.lines().map((item) => item.offerId)).toEqual(["o1"]);
});

test("removing asks when several items match equally", async () => {
  const { cart, agent } = cartWith(
    line("o1", "Rain Jacket"),
    line("o2", "Rain Boots"),
  );

  const reply = await agent.execute(
    request({ intent: "remove_from_cart", product: "rain" }),
  );

  expect(reply.text).toContain("Rain Jacket");
  expect(reply.text).toContain("Rain Boots");
  expect(cart.lines()).toHaveLength(2);
});

test("removing a product that is not in the cart says so", async () => {
  const { cart, agent } = cartWith(line("o1", "Rain Jacket"));

  const reply = await agent.execute(
    request({ intent: "remove_from_cart", product: "hat" }),
  );

  expect(reply.text).toBe("I could not find “hat” in your cart.");
  expect(cart.lines()).toHaveLength(1);
});

test("removing by number alone still works", async () => {
  const { cart, agent } = cartWith(
    line("o1", "Rain Jacket"),
    line("o2", "Wool Socks"),
  );

  await agent.execute(request({ intent: "remove_from_cart", number: 2 }));

  expect(cart.lines().map((item) => item.offerId)).toEqual(["o1"]);
});

test("adding prefers the named product over a wrong number", async () => {
  const { trpc, queryClient } = createTestTRPCOptions();
  const boots = { ...jacket, id: "p2", name: "Rain Boots" };
  vi.spyOn(queryClient, "query").mockResolvedValue([jacket, boots]);
  const cart = memoryCart();
  const agent = createShoppingAgent(undefined, trpc, queryClient, cart);
  await agent.execute(request({ product: "rain" }));

  await agent.execute(
    request({ intent: "add_to_cart", product: "boots", number: 1 }),
  );

  expect(cart.lines().map((item) => item.name)).toEqual(["Rain Boots"]);
});

test.each([
  ["shoes", "Trail Shoe"],
  ["shoe", "Trail Shoes"],
])("removing %s matches %s", async (product, name) => {
  const { cart, agent } = cartWith(line("o1", "Rain Jacket"), line("o2", name));

  await agent.execute(request({ intent: "remove_from_cart", product }));

  expect(cart.lines().map((item) => item.offerId)).toEqual(["o1"]);
});

test("a product word inside another word does not match", async () => {
  const { cart, agent } = cartWith(
    line("o1", "Escape Backpack"),
    line("o2", "Wool Socks"),
  );

  const reply = await agent.execute(
    request({ intent: "remove_from_cart", product: "cap" }),
  );

  expect(reply.text).toBe("I could not find “cap” in your cart.");
  expect(cart.lines()).toHaveLength(2);
});

test("a word that only appears in the variant does not match", async () => {
  const { cart, agent } = cartWith(
    line("o1", "Rain Jacket", "M / Black"),
    line("o2", "Wool Socks", "L / Grey"),
  );

  const reply = await agent.execute(
    request({ intent: "remove_from_cart", product: "black hat" }),
  );

  expect(reply.text).toBe("I could not find “black hat” in your cart.");
  expect(cart.lines()).toHaveLength(2);
});

test("adding a product that was not shown does not pick the only option", async () => {
  const { trpc, queryClient } = createTestTRPCOptions();
  vi.spyOn(queryClient, "query").mockResolvedValue([jacket]);
  const cart = memoryCart();
  const agent = createShoppingAgent(undefined, trpc, queryClient, cart);
  await agent.execute(request({ product: "jacket" }));

  const reply = await agent.execute(
    request({ intent: "add_to_cart", product: "boots" }),
  );

  expect(reply.text).toBe("“boots” is not among the options I showed you.");
  expect(cart.lines()).toEqual([]);
});

test("a named product that matches nothing falls back to the number", async () => {
  const { cart, agent } = cartWith(line("o1", "Rain Jacket"));

  const reply = await agent.execute(
    request({ intent: "remove_from_cart", product: "hat", number: 1 }),
  );

  expect(reply.text).toBe("Removed Rain Jacket from your cart.");
  expect(cart.lines()).toHaveLength(0);
});

test("adding a named product that was not shown falls back to the number", async () => {
  const { trpc, queryClient } = createTestTRPCOptions();
  vi.spyOn(queryClient, "query").mockResolvedValue([jacket]);
  const cart = memoryCart();
  const agent = createShoppingAgent(undefined, trpc, queryClient, cart);
  await agent.execute(request({ product: "jacket" }));

  const reply = await agent.execute(
    request({ intent: "add_to_cart", product: "boots", number: 1 }),
  );

  expect(reply.text).toMatch(/^Added 1 × Rain Jacket/);
  expect(cart.lines()).toHaveLength(1);
});
