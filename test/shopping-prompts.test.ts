import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { readUIMessageStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ShoppingMessage } from "~/lib/shopping-agent";
import { appRouter } from "~/server/api/root";
import { findProduct, listProducts, listVendors, validateCatalogCart } from "~/server/db/catalog";
import { relations } from "~/server/db/relations";
import type { Offer, Product, Vendor } from "~/types";

const { webLLM } = vi.hoisted(() => ({ webLLM: vi.fn() }));
vi.mock("@browser-ai/web-llm", () => ({ webLLM }));
vi.mock(import("~/server/db/catalog"), async (importOriginal) => ({
  ...await importOriginal(),
  findProduct: vi.fn(),
  listProducts: vi.fn(),
  listVendors: vi.fn(),
  validateCatalogCart: vi.fn(),
}));

const connection = postgres("postgresql://unused:unused@127.0.0.1:1/unused");
const db = drizzle({ client: connection, relations });
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
  categoryId: "category-accessories",
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

async function sendPrompt(prompt: string, replies: ModelReply[]) {
  const model = new MockLanguageModelV4({ doGenerate: replies });
  webLLM.mockReturnValue(Object.assign(model, {
    createSessionWithProgress: async () => model,
  }));
  const { createShoppingTransport } = await import("~/lib/shopping-agent");
  const stream = await createShoppingTransport().sendMessages({
    trigger: "submit-message",
    chatId: "shopping-test",
    messageId: undefined,
    messages: [{ id: "user-1", role: "user", parts: [{ type: "text", text: prompt }] }],
    abortSignal: undefined,
  });
  let message: ShoppingMessage | undefined;
  for await (const snapshot of readUIMessageStream<ShoppingMessage>({ stream, terminateOnError: true })) {
    message = snapshot;
  }
  expect(model.doGenerateCalls[0]?.prompt).toContainEqual({
    role: "user",
    content: [{ type: "text", text: prompt }],
  });
  return { parts: message?.parts ?? [], model };
}

describe("shopping prompts with scripted model replies", () => {
  it.each([
    { prompt: "Find me a campus backpack.", filters: { q: "backpack" }, total: 1 },
    { prompt: "Show me backpacks under €75.", filters: { q: "backpack", maxPrice: 7500 }, total: 1 },
    { prompt: "Are there backpacks under €55?", filters: { q: "backpack", maxPrice: 5500 }, total: 0 },
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
});
