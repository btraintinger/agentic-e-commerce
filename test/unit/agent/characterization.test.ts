import { beforeEach, describe, expect, test, vi } from "vitest";
import { toOptions } from "@/agent/agent-util/product-options";
import { ProductSearch } from "@/agent/agent-util/product-search";
import { selectByProduct } from "@/agent/agent-util/matching";
import { failureReply, offTopicReply } from "@/agent/agent-util/replies";
import { ShoppingAgent } from "@/agent/shopping-agent";
import type { CartLine, ShopRequest } from "@/agent/types";
import type * as ParseMessageModule from "@/agent/message-parser/parse-message";
import { createTestTRPCOptions } from "../../support/trpc-client";

vi.mock("server-only", () => ({}));

const createShoppingAgent = (
  ...args: ConstructorParameters<typeof ShoppingAgent>
) => new ShoppingAgent(...args);

const { parseUserMessage } = vi.hoisted(() => ({ parseUserMessage: vi.fn() }));
vi.mock("@/agent/message-parser/parse-message", async (importOriginal) => ({
  ...(await importOriginal<typeof ParseMessageModule>()),
  parseUserMessage,
}));

beforeEach(() => {
  vi.restoreAllMocks();
  parseUserMessage.mockReset();
  vi.spyOn(console, "debug").mockImplementation(() => undefined);
});

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

type Stock = "NO" | "LITTLE" | "ALOT";

const offer = (id: string, price: number, stock: Stock = "ALOT") => ({
  id,
  vendorId: "v",
  warehouseId: "w",
  price,
  currency: "EUR" as const,
  shippingCost: 0,
  stock,
  deliveryDays: { min: 1, max: 2 },
});

const variant = (
  id: string,
  name: string,
  attributes: Record<string, string>,
  offers: ReturnType<typeof offer>[],
) => ({ id, sku: id, name, attributes, offers });

const product = (
  id: string,
  name: string,
  variants: ReturnType<typeof variant>[],
) => ({
  id,
  categoryId: "c",
  name,
  description: "",
  tags: [],
  attributes: {},
  variants,
});

const simple = (id: string, name: string, price = 1000) =>
  product(id, name, [variant(`${id}-v`, "M", {}, [offer(`${id}-o`, price)])]);

const named = (name: string, variantName = "M") => ({ name, variantName });

function memoryCart(initial: CartLine[] = []) {
  let lines = [...initial];
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

const line = (offerId: string, name: string, variantName = "M"): CartLine => ({
  offerId,
  name,
  variantName,
  price: 1000,
  quantity: 1,
});

function setup(cart = memoryCart(), model?: object) {
  const { trpc, queryClient } = createTestTRPCOptions();
  const query = vi.spyOn(queryClient, "query");
  const agent = createShoppingAgent(
    model as Parameters<typeof createShoppingAgent>[0],
    trpc,
    queryClient,
    cart,
  );
  return { agent, cart, query };
}

describe("selectByProduct", () => {
  test("an exact phrase beats single-word matches", () => {
    const items = [named("Rain Boots"), named("Rain Jacket"), named("Jacket")];
    expect(selectByProduct(items, "rain jacket", null)).toEqual({
      kind: "found",
      item: items[1],
    });
  });

  test("plural and singular words match", () => {
    const items = [named("Jacket"), named("Socks")];
    expect(selectByProduct(items, "jackets", null)).toEqual({
      kind: "found",
      item: items[0],
    });
  });

  test("a tie is broken by the variant name", () => {
    const items = [named("Jacket", "M / Red"), named("Jacket", "M / Black")];
    expect(selectByProduct(items, "black jacket", null)).toEqual({
      kind: "found",
      item: items[1],
    });
  });

  test("a tie is broken by the number", () => {
    const items = [named("Rain Jacket"), named("Rain Boots")];
    expect(selectByProduct(items, "rain", 2)).toEqual({
      kind: "found",
      item: items[1],
    });
  });

  test("a number outside the tie does not decide", () => {
    const items = [named("Socks"), named("Rain Jacket"), named("Rain Boots")];
    expect(selectByProduct(items, "rain", 1)).toEqual({
      kind: "ambiguous",
      items: [items[1], items[2]],
    });
  });

  test("equal matches are ambiguous", () => {
    const items = [named("Rain Jacket"), named("Rain Boots")];
    expect(selectByProduct(items, "rain", null)).toEqual({
      kind: "ambiguous",
      items,
    });
  });

  test("nothing matching returns none", () => {
    expect(selectByProduct([named("Rain Jacket")], "hat", 1)).toEqual({
      kind: "none",
    });
  });
});

/** Runs ProductSearch.find and returns the input sent to `products.list`. */
async function searchInput(product: string, shopRequest: ShopRequest) {
  const { trpc, queryClient } = createTestTRPCOptions();
  const query = vi.spyOn(queryClient, "query").mockResolvedValue([]);
  await new ProductSearch(trpc, queryClient).find(product, shopRequest);
  const [options] = query.mock.calls[0];
  return (options.queryKey[1] as { input: unknown }).input;
}

describe("ProductSearch filters", () => {
  test("leaves out empty price limits", async () => {
    expect(await searchInput("hat", request({}))).toEqual({ q: "hat" });
  });

  test("rounds euros to cents", async () => {
    expect(
      await searchInput(
        "hat",
        request({ product: "hat", minPriceEur: 0, maxPriceEur: 19.995 }),
      ),
    ).toEqual({ q: "hat", minPrice: 0, maxPrice: 2000 });
  });
});

describe("toOptions", () => {
  const gendered = product("p", "Jacket", [
    variant("f", "Female", { gender: "female" }, [offer("o-f", 1000)]),
    variant("u", "Unisex", { gender: "unisex" }, [offer("o-u", 3000)]),
    variant("n", "None", {}, [offer("o-n", 2000)]),
    variant("m", "Male", { gender: "male" }, [offer("o-m", 500)]),
  ]);

  test("price bounds are inclusive and in cents", () => {
    const options = toOptions(
      [simple("a", "A", 999), simple("b", "B", 1000), simple("c", "C", 2001)],
      request({ minPriceEur: 10, maxPriceEur: 20.01 }),
    );
    expect(options.map((o) => o.productId)).toEqual(["b", "c"]);
  });

  test("gender keeps unisex and variants without gender", () => {
    const [option] = toOptions([gendered], request({ gender: "female" }));
    expect(option?.offerId).toBe("o-f");
    const [maleOption] = toOptions([gendered], request({ gender: "male" }));
    expect(maleOption?.offerId).toBe("o-m");
    const unisexOnly = toOptions(
      [gendered],
      request({ gender: "female", minPriceEur: 15 }),
    );
    expect(unisexOnly[0]?.offerId).toBe("o-n");
  });

  test("without gender the cheapest offer of any variant wins", () => {
    const [option] = toOptions([gendered], request({}));
    expect(option).toEqual({
      number: 1,
      productId: "p",
      offerId: "o-m",
      name: "Jacket",
      variantName: "Male",
      price: 500,
    });
  });

  test("offers out of stock are excluded", () => {
    const soldOut = product("p", "Hat", [
      variant("v", "M", {}, [offer("o1", 100, "NO"), offer("o2", 200)]),
    ]);
    const empty = product("q", "Cap", [
      variant("v", "M", {}, [offer("o3", 100, "NO")]),
    ]);
    const options = toOptions([soldOut, empty], request({}));
    expect(options.map((o) => o.offerId)).toEqual(["o2"]);
  });

  test("at most five options, numbered in order", () => {
    const products = Array.from({ length: 7 }, (_, i) =>
      simple(`p${i}`, `P${i}`),
    );
    const options = toOptions(products, request({}));
    expect(options.map((o) => [o.number, o.productId])).toEqual([
      [1, "p0"],
      [2, "p1"],
      [3, "p2"],
      [4, "p3"],
      [5, "p4"],
    ]);
  });
});

describe("shopping agent", () => {
  test("search with results lists the options", async () => {
    const { agent, query } = setup();
    query.mockResolvedValue([simple("p1", "Rain Jacket")]);

    const reply = await agent.execute(request({ product: "jacket" }));

    expect(reply.text).toBe(
      "I found 1 option for “jacket”. Which one would you like?",
    );
    expect(reply.options).toHaveLength(1);
    expect(query).toHaveBeenCalledTimes(1);
  });

  test("search without results says so", async () => {
    const { agent, query } = setup();
    query.mockResolvedValue([]);

    const reply = await agent.execute(request({ product: "rain hat" }));

    expect(reply).toEqual({
      request: request({ product: "rain hat" }),
      text: "Sorry, I found no “rain hat” that matches your request.",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  test("search without a product asks for one", async () => {
    const { agent, query } = setup();
    const reply = await agent.execute(request({}));
    expect(reply.text).toBe("What kind of product are you looking for?");
    expect(query).not.toHaveBeenCalled();
  });

  test("search without hits does not retry with single words", async () => {
    const { agent, query } = setup();
    query.mockResolvedValue([]);

    await agent.execute(request({ product: "rain jacket" }));

    expect(query).toHaveBeenCalledTimes(1);
  });

  test("add_to_cart by number", async () => {
    const { agent, cart, query } = setup();
    query.mockResolvedValue([simple("p1", "Rain Jacket"), simple("p2", "Hat")]);
    await agent.execute(request({ product: "x" }));

    const reply = await agent.execute(
      request({ intent: "add_to_cart", number: 2, quantity: 3 }),
    );

    expect(reply.text).toBe("Added 3 × Hat (M) to your cart.");
    expect(cart.lines()).toEqual([
      {
        offerId: "p2-o",
        name: "Hat",
        variantName: "M",
        price: 1000,
        quantity: 3,
      },
    ]);
  });

  test("add_to_cart by name", async () => {
    const { agent, cart, query } = setup();
    query.mockResolvedValue([simple("p1", "Rain Jacket"), simple("p2", "Hat")]);
    await agent.execute(request({ product: "x" }));

    const reply = await agent.execute(
      request({ intent: "add_to_cart", product: "jacket" }),
    );

    expect(reply.text).toBe("Added 1 × Rain Jacket (M) to your cart.");
    expect(cart.lines()).toHaveLength(1);
  });

  test("add_to_cart without a number among several options asks", async () => {
    const { agent, query } = setup();
    query.mockResolvedValue([simple("p1", "Rain Jacket"), simple("p2", "Hat")]);
    await agent.execute(request({ product: "x" }));

    const reply = await agent.execute(request({ intent: "add_to_cart" }));

    expect(reply.text).toBe(
      "Which option do you mean? Please name a number from 1 to 2.",
    );
  });

  test("add_to_cart ambiguous by name lists the options", async () => {
    const { agent, query } = setup();
    query.mockResolvedValue([
      simple("p1", "Rain Jacket"),
      simple("p2", "Rain Boots"),
    ]);
    await agent.execute(request({ product: "x" }));

    const reply = await agent.execute(
      request({ intent: "add_to_cart", product: "rain" }),
    );

    expect(reply.text).toBe(
      "Which one do you mean: Rain Jacket (M), Rain Boots (M)?",
    );
  });

  test.each([{}, { number: 1 }, { product: "jacket" }])(
    "add_to_cart without a previous search asks to search first (%o)",
    async (fields) => {
      const { agent, cart } = setup();
      const reply = await agent.execute(
        request({ intent: "add_to_cart", ...fields }),
      );
      expect(reply.text).toBe(
        "Please search for a product first, then pick an option.",
      );
      expect(cart.lines()).toEqual([]);
    },
  );

  test("addOption adds one item", () => {
    const { agent, cart } = setup();
    const [option] = toOptions([simple("p1", "Hat")], request({}));
    if (!option) throw new Error("expected an option");
    const { addOption } = agent;

    expect(addOption(option)).toBe("Added 1 × Hat (M) to your cart.");
    expect(cart.lines()).toHaveLength(1);
  });

  test("remove_from_cart on an empty cart", async () => {
    const { agent } = setup();
    const reply = await agent.execute(
      request({ intent: "remove_from_cart", product: "hat" }),
    );
    expect(reply.text).toBe("Your cart is already empty.");
  });

  test("remove_from_cart by name", async () => {
    const { agent, cart } = setup(
      memoryCart([line("o1", "Rain Jacket"), line("o2", "Wool Socks")]),
    );
    const reply = await agent.execute(
      request({ intent: "remove_from_cart", product: "sock" }),
    );
    expect(reply.text).toBe("Removed Wool Socks from your cart.");
    expect(cart.lines().map((l) => l.offerId)).toEqual(["o1"]);
  });

  test("remove_from_cart ambiguous", async () => {
    const { agent, cart } = setup(
      memoryCart([line("o1", "Rain Jacket", "S"), line("o2", "Rain Boots")]),
    );
    const reply = await agent.execute(
      request({ intent: "remove_from_cart", product: "rain" }),
    );
    expect(reply.text).toBe(
      "Which one should I remove: Rain Jacket (S), Rain Boots (M)?",
    );
    expect(cart.lines()).toHaveLength(2);
  });

  test("remove_from_cart without product or number among several asks", async () => {
    const { agent } = setup(
      memoryCart([line("o1", "Rain Jacket"), line("o2", "Hat")]),
    );
    const reply = await agent.execute(request({ intent: "remove_from_cart" }));
    expect(reply.text).toBe(
      "Which item should I remove? Please name it or its position in the cart.",
    );
  });

  test("off_topic", async () => {
    const { agent, query } = setup();
    const offTopic = request({ intent: "off_topic" });
    expect(await agent.execute(offTopic)).toEqual({
      request: offTopic,
      text: offTopicReply,
    });
    expect(query).not.toHaveBeenCalled();
  });

  test("an exception in the search returns the failure reply", async () => {
    const { agent, query } = setup(memoryCart(), {});
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    query.mockRejectedValue(new Error("down"));
    const search = request({ product: "hat" });
    parseUserMessage.mockResolvedValue(search);

    expect(await agent.handleMessage("a hat")).toEqual({
      request: search,
      text: failureReply,
    });
  });

  test("handleMessage runs the recognized intent", async () => {
    const { agent } = setup(memoryCart(), {});
    parseUserMessage.mockResolvedValue(request({ intent: "off_topic" }));
    const { handleMessage } = agent;

    expect((await handleMessage("poem")).text).toBe(offTopicReply);
  });

  test("model not loaded", async () => {
    const { agent } = setup();
    expect(await agent.handleMessage("hi")).toEqual({
      text: "The language model is not loaded yet.",
    });
    expect(parseUserMessage).not.toHaveBeenCalled();
  });

  test("an unrecognized intent asks to rephrase", async () => {
    const { agent } = setup(memoryCart(), {});
    parseUserMessage.mockResolvedValue(null);
    expect(await agent.handleMessage("???")).toEqual({
      text: "Sorry, I did not get that. Could you please ask again?",
    });
  });
});
