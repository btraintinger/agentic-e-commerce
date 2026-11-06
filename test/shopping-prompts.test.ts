import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { readUIMessageStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ShoppingMessage } from "~/lib/shopping-agent";
import { appRouter } from "~/server/api/root";
import {
  findProduct, listCategories, listProducts, listVendors, validateCatalogCart,
} from "~/server/db/catalog";
import { relations } from "~/server/db/relations";
import type { CartIssue, Category, Offer, Product, Vendor } from "~/types";

const { webLLM } = vi.hoisted(() => ({ webLLM: vi.fn() }));
vi.mock("@browser-ai/web-llm", () => ({ webLLM }));
vi.mock(import("~/server/db/catalog"), async (importOriginal) => ({
  ...await importOriginal(),
  findProduct: vi.fn(),
  listCategories: vi.fn(),
  listProducts: vi.fn(),
  listVendors: vi.fn(),
  validateCatalogCart: vi.fn(),
}));

const connection = postgres("postgresql://unused:unused@127.0.0.1:1/unused");
const db = drizzle({ client: connection, relations });
const category: Category = {
  id: "category-accessories",
  name: "Campus Accessories",
  description: "Backpacks and other everyday items",
};
const vendor: Vendor = { id: "vendor-campus", name: "Campus Shop", rating: 4.5 };
const offer: Offer = {
  id: "offer-campus",
  vendorId: vendor.id,
  warehouseId: "warehouse-linz",
  price: 6500,
  currency: "EUR",
  shippingCost: 400,
  deliveryDays: { min: 2, max: 4 },
  stock: "ALOT",
};
const product: Product = {
  id: "product-backpack",
  categoryId: category.id,
  name: "Campus Backpack",
  description: "A backpack with a padded laptop sleeve",
  tags: [],
  attributes: {},
  variants: [{
    id: "variant-black",
    sku: "BACKPACK-BLACK",
    name: "Black",
    attributes: {},
    offers: [
      { ...offer, id: "offer-sold-out", price: 5000, stock: "NO" },
      offer,
    ],
  }],
};

type ModelReply = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;
const usage: ModelReply["usage"] = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function toolCall(toolName: string, input: object, toolCallId = "call-1"): ModelReply {
  return {
    content: [{ type: "tool-call", toolCallId, toolName, input: JSON.stringify(input) }],
    finishReason: { unified: "tool-calls", raw: undefined },
    usage,
    warnings: [],
  };
}

const finalReply: ModelReply = {
  content: [{ type: "text", text: "Here is what I found." }],
  finishReason: { unified: "stop", raw: undefined },
  usage,
  warnings: [],
};

const fetchCatalog = vi.fn(async (path: string, init?: RequestInit) => {
  const req = new Request(new URL(path, "http://localhost"), init);
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({
      db,
      headers: req.headers,
      getSession: async () => null,
      rateLimitKey: "shopping-prompt-test",
    }),
  });
});

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubGlobal("navigator", { gpu: {} });
  vi.stubGlobal("fetch", fetchCatalog);
});

afterEach(() => vi.unstubAllGlobals());
afterAll(() => connection.end());

async function createPromptSession(replies: ModelReply[]) {
  const model = new MockLanguageModelV4({ doGenerate: replies });
  webLLM.mockReturnValue(Object.assign(model, {
    createSessionWithProgress: async () => model,
  }));
  const { createShoppingTransport } = await import("~/lib/shopping-agent");
  const transport = createShoppingTransport();

  async function send(prompt: string, history: ShoppingMessage[] = []) {
    const nextCall = model.doGenerateCalls.length;
    const messages: ShoppingMessage[] = [
      ...history,
      { id: `user-${history.length}`, role: "user", parts: [{ type: "text", text: prompt }] },
    ];
    const stream = await transport.sendMessages({
      trigger: "submit-message",
      chatId: "shopping-test",
      messageId: undefined,
      messages,
      abortSignal: undefined,
    });
    let message: ShoppingMessage | undefined;
    for await (const snapshot of readUIMessageStream<ShoppingMessage>({ stream, terminateOnError: true })) {
      message = snapshot;
    }
    expect(model.doGenerateCalls[nextCall]?.prompt).toContainEqual({
      role: "user",
      content: [{ type: "text", text: prompt }],
    });
    if (!message) throw new Error("Expected an assistant message");
    return { parts: message.parts, messages: [...messages, message], model };
  }

  return { send };
}

async function sendPrompt(prompt: string, replies: ModelReply[]) {
  const session = await createPromptSession(replies);
  return session.send(prompt);
}

describe("shopping prompts with scripted model replies", () => {
  it.each([
    { prompt: "Find me a campus backpack.", filters: { q: "backpack" }, total: 1 },
    { prompt: "Show me backpacks under €75.", filters: { q: "backpack", maxPrice: 7500 }, total: 1 },
    { prompt: "Are there backpacks under €55?", filters: { q: "backpack", maxPrice: 5500 }, total: 0 },
    {
      prompt: "Ich suche einen Rucksack zwischen 60 und 70 Euro.",
      filters: { q: "backpack", minPrice: 6000, maxPrice: 7000 },
      total: 1,
    },
  ])("shows matching in-stock products for $prompt", async ({ prompt, filters, total }) => {
    vi.mocked(listProducts).mockResolvedValue([product]);

    const { parts, model } = await sendPrompt(prompt, [toolCall("searchProducts", filters), finalReply]);

    expect(listProducts).toHaveBeenCalledExactlyOnceWith(db, filters);
    expect(parts).toContainEqual(expect.objectContaining({
      type: "tool-searchProducts",
      state: "output-available",
      output: {
        total,
        products: total ? [{
          id: product.id,
          name: product.name,
          description: product.description,
          price: 6500,
          stock: "ALOT",
        }] : [],
      },
    }));
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(parts).toContainEqual(expect.objectContaining({ type: "text", text: "Here is what I found." }));
  });

  it("passes an empty search result back to the model before a broader search", async () => {
    vi.mocked(listProducts).mockResolvedValueOnce([]).mockResolvedValueOnce([product]);
    const { parts, model } = await sendPrompt("Find me an ultralight backpack.", [
      toolCall("searchProducts", { q: "ultralight backpack" }),
      toolCall("searchProducts", { q: "backpack" }, "call-2"),
      finalReply,
    ]);

    expect(listProducts).toHaveBeenNthCalledWith(1, db, { q: "ultralight backpack" });
    expect(listProducts).toHaveBeenNthCalledWith(2, db, { q: "backpack" });
    expect(model.doGenerateCalls[1]?.prompt).toContainEqual(expect.objectContaining({
      role: "tool",
      content: [expect.objectContaining({
        toolName: "searchProducts",
        output: { type: "json", value: { total: 0, products: [] } },
      })],
    }));
    expect(parts).toContainEqual(expect.objectContaining({
      type: "tool-searchProducts",
      toolCallId: "call-2",
      state: "output-available",
      output: expect.objectContaining({ total: 1 }),
    }));
  });

  it("shows the selected product's offers with the in-stock offer first", async () => {
    vi.mocked(findProduct).mockResolvedValue(product);
    vi.mocked(listVendors).mockResolvedValue([vendor]);
    const { parts } = await sendPrompt(
      "Show offers for Campus Backpack (product ID product-backpack).",
      [toolCall("getOffers", { id: product.id }), finalReply],
    );

    expect(findProduct).toHaveBeenCalledExactlyOnceWith(db, product.id);
    expect(listVendors).toHaveBeenCalledExactlyOnceWith(db);
    expect(parts).toContainEqual(expect.objectContaining({
      type: "tool-getOffers",
      state: "output-available",
      output: {
        product: expect.objectContaining({ id: product.id }),
        offers: [
          expect.objectContaining({ id: offer.id, vendor: vendor.name, variant: "Black", price: 6500 }),
          expect.objectContaining({ id: "offer-sold-out", stock: "NO" }),
        ],
      },
    }));
  });

  it("checks quantities and a supplied voucher without sending shipment details to the model", async () => {
    const cart = { items: [{ offerId: offer.id, quantity: 2 }], voucherCode: "STUDENT10" };
    const totals = { items: 13000, shipping: 1100, discount: 1300, grand: 12800 };
    vi.mocked(validateCatalogCart).mockResolvedValue({
      valid: true,
      issues: [],
      shipments: [],
      totals,
      deliveryDays: offer.deliveryDays,
      packageCount: 1,
    });

    const { parts } = await sendPrompt("Check 2 of offer-campus with voucher STUDENT10.", [
      toolCall("validateCart", cart),
      finalReply,
    ]);

    expect(validateCatalogCart).toHaveBeenCalledExactlyOnceWith(db, cart);
    expect(parts).toContainEqual(expect.objectContaining({
      type: "tool-validateCart",
      state: "output-available",
      output: { valid: true, issues: [], totals, deliveryDays: offer.deliveryDays, packageCount: 1 },
    }));
  });

  it("shows a clarification and waits without a catalog request", async () => {
    const question = { question: "What is your budget?", options: ["Under €50", "€50 or more"] };
    const { parts, model } = await sendPrompt("Help me choose something for campus.", [
      toolCall("askQuestion", question),
      finalReply,
    ]);

    expect(parts).toContainEqual(expect.objectContaining({
      type: "tool-askQuestion",
      state: "output-available",
      output: question,
    }));
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(fetchCatalog).not.toHaveBeenCalled();
  });

  it("uses a catalog category ID to browse campus accessories", async () => {
    vi.mocked(listCategories).mockResolvedValue([category]);
    vi.mocked(listProducts).mockResolvedValue([product]);
    const { parts, model } = await sendPrompt("What can I browse in Campus Accessories?", [
      toolCall("listCategories", {}),
      toolCall("searchProducts", { category: category.id }, "call-2"),
      finalReply,
    ]);
    const categories = [{ id: category.id, name: category.name }];

    expect(listCategories).toHaveBeenCalledExactlyOnceWith(db);
    expect(listProducts).toHaveBeenCalledExactlyOnceWith(db, { category: category.id });
    expect(model.doGenerateCalls[1]?.prompt).toContainEqual(expect.objectContaining({
      role: "tool",
      content: [expect.objectContaining({
        toolName: "listCategories",
        output: { type: "json", value: { categories } },
      })],
    }));
    expect(parts).toContainEqual(expect.objectContaining({
      type: "tool-searchProducts",
      state: "output-available",
      output: expect.objectContaining({ total: 1 }),
    }));
  });

  it("resumes a backpack search with the shopper's answer to a budget question", async () => {
    const budget = "Under €75";
    const question = { question: "What is your budget?", options: [budget, "€75 or more"] };
    const filters = { q: "backpack", maxPrice: 7500 };
    vi.mocked(listProducts).mockResolvedValue([product]);
    const session = await createPromptSession([
      toolCall("askQuestion", question),
      toolCall("searchProducts", filters, "call-2"),
      finalReply,
    ]);

    const first = await session.send("I need a backpack for lectures.");
    expect(fetchCatalog).not.toHaveBeenCalled();
    const { parts, model } = await session.send(budget, first.messages);

    expect(model.doGenerateCalls[1]?.prompt).toEqual(expect.arrayContaining([
      {
        role: "user",
        content: [{ type: "text", text: "I need a backpack for lectures." }],
      },
      expect.objectContaining({
        role: "tool",
        content: [expect.objectContaining({
          toolName: "askQuestion",
          output: { type: "json", value: question },
        })],
      }),
    ]));
    expect(listProducts).toHaveBeenCalledExactlyOnceWith(db, filters);
    expect(parts).toContainEqual(expect.objectContaining({
      type: "tool-searchProducts",
      state: "output-available",
    }));
  });

  it("returns a text-only reply for an out-of-scope task", async () => {
    const text = "I can help with the JKU webshop, but I cannot book train tickets.";
    const { parts, model } = await sendPrompt("Book me a train to Vienna tomorrow.", [{
      ...finalReply,
      content: [{ type: "text", text }],
    }]);

    expect(parts).toContainEqual(expect.objectContaining({ type: "text", text }));
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(fetchCatalog).not.toHaveBeenCalled();
  });

  it("reports that a product from an older recommendation is gone", async () => {
    const id = "product-discontinued";
    vi.mocked(findProduct).mockResolvedValue(undefined);
    vi.mocked(listVendors).mockResolvedValue([vendor]);
    const { parts } = await sendPrompt("Is product-discontinued still available for delivery?", [
      toolCall("getOffers", { id }),
      finalReply,
    ]);

    expect(findProduct).toHaveBeenCalledExactlyOnceWith(db, id);
    expect(parts).toContainEqual(expect.objectContaining({
      type: "tool-getOffers",
      state: "output-error",
      errorText: "That product is no longer in the catalog.",
    }));
  });

  it("preserves the cart totals and issue when the voucher is unknown", async () => {
    const cart = { items: [{ offerId: offer.id, quantity: 1 }], voucherCode: "EXPIREDDEAL" };
    const issue: CartIssue = { code: "VOUCHER_NOT_FOUND", message: "Voucher EXPIREDDEAL not found" };
    const totals = { items: 6500, shipping: 700, discount: 0, grand: 7200 };
    vi.mocked(validateCatalogCart).mockResolvedValue({
      valid: false,
      issues: [issue],
      shipments: [],
      totals,
      deliveryDays: offer.deliveryDays,
      packageCount: 1,
    });
    const { parts } = await sendPrompt("Does EXPIREDDEAL work on one offer-campus?", [
      toolCall("validateCart", cart),
      finalReply,
    ]);

    expect(validateCatalogCart).toHaveBeenCalledExactlyOnceWith(db, cart);
    expect(parts).toContainEqual(expect.objectContaining({
      type: "tool-validateCart",
      state: "output-available",
      output: expect.objectContaining({ valid: false, issues: [issue], totals }),
    }));
  });

  it("rejects contradictory price bounds before calling the shop", async () => {
    const { parts } = await sendPrompt("Find a backpack that costs at least €80 and at most €50.", [
      toolCall("searchProducts", { q: "backpack", minPrice: 8000, maxPrice: 5000 }),
      finalReply,
    ]);

    expect(parts).toContainEqual(expect.objectContaining({
      type: "tool-searchProducts",
      state: "output-error",
      errorText: "The minimum price must be at or below the maximum price.",
    }));
    expect(fetchCatalog).not.toHaveBeenCalled();
  });
});
