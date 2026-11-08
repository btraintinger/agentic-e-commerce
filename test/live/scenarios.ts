import { createTRPCClient, httpLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "../../src/server/api/root";
import type { Turn } from "./browser";

export interface ShopRequest {
  endpoint: string;
  method: string;
  status: number;
  input?: Record<string, unknown>;
}

interface Scenario {
  id: string;
  group: string;
  prompts: string[];
  check: (turns: Turn[], requests: ShopRequest[]) => string | undefined;
}

function quickReply(turns: Turn[]) {
  if (!turns.some(({ parts }) => parts.some((part) =>
    part.type === "tool-askQuestion" && part.state === "output-available" && part.output.options.length >= 2))) {
    return "Expected a structured clarification with clickable choices.";
  }
}

interface SearchExpectation {
  q?: RegExp;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  result?: "empty" | "nonempty" | "either";
}

function expectSearch({ q, minPrice, maxPrice, category, result = "nonempty" }: SearchExpectation): Scenario["check"] {
  return (turns, requests) => {
    const matchingRequests = requests.filter(({ endpoint, status, input }) =>
      endpoint === "products.list" && status === 200 && input !== undefined &&
      (q === undefined || (typeof input.q === "string" && q.test(input.q.trim()))) &&
      input.minPrice === minPrice && input.maxPrice === maxPrice && input.category === category);

    const matched = turns.some(({ parts }) => parts.some((part) =>
      part.type === "tool-searchProducts" && part.state === "output-available" &&
      matchingRequests.some(({ input }) => input?.q === part.input.q && input?.category === part.input.category &&
        input?.minPrice === part.input.minPrice && input?.maxPrice === part.input.maxPrice) &&
      (result === "either" || (result === "empty" ? part.output.total === 0 : part.output.total > 0)) &&
      part.output.products.every(({ stock, price }) => stock !== "NO" &&
        price >= (minPrice ?? 0) && price <= (maxPrice ?? Infinity))));

    if (!matched) return `Expected the catalog search to use the requested filters and return a ${result === "either" ? "valid" : result} result.`;
  };
}

export async function loadScenarios(origin: string) {
  const api = createTRPCClient<AppRouter>({
    links: [httpLink({ url: `${origin}/api/trpc`, transformer: superjson })],
  });
  await api.health.query(undefined, { signal: AbortSignal.timeout(10_000) });
  const signal = AbortSignal.timeout(10_000);
  const [categories, laptops, headphones, backpacks, starter] = await Promise.all([
    api.categories.list.query(undefined, { signal }),
    api.products.list.query({ q: "ThinkPad" }, { signal }),
    api.products.list.query({ q: "headphones", maxPrice: 8000 }, { signal }),
    api.products.list.query({ q: "backpack" }, { signal }),
    api.products.list.query({ q: "starter-set" }, { signal }),
  ]);
  const accessories = categories.find(({ name }) => /accessor/i.test(name));
  const laptop = laptops[0];
  const offer = backpacks.flatMap(({ variants }) => variants.flatMap(({ offers }) => offers))
    .find(({ stock }) => stock !== "NO");
  if (!accessories || !laptop || !offer || !starter.length) {
    throw new Error("The evaluation requires the fixed-seed catalog. Run pnpm db:seed first.");
  }

  const headphonesInBudget = headphones.filter(({ variants }) => variants.some(({ offers }) =>
    offers.some(({ stock, price }) => stock !== "NO" && price <= 8000))).length;
  const fixtures = { categoryCount: categories.length, headphonesInBudget, starterSetCount: starter.length };
  const scenarios: Scenario[] = [];
  const add = (id: string, group: string, prompts: string | string[], check: Scenario["check"]) => {
    scenarios.push({ id, group, prompts: typeof prompts === "string" ? [prompts] : prompts, check });
  };

  const laptopPrompt = "Find ThinkPad laptops in the shop and show the matching products.";
  const headphonesPrompt = "Show me headphones for €80 or less.";
  const starterPrompt = "What’s in the JKU Starter Set?";
  const giftPrompt = "Help me pick a gift for a student.";
  const expectLaptop = expectSearch({ q: /^thinkpad$/i });
  const expectHeadphones = expectSearch({
    q: /^headphones?$/i, maxPrice: 8000, result: headphonesInBudget ? "nonempty" : "empty",
  });
  const expectStarter = expectSearch({ q: /^starter-set$/i });
  const expectFlux = expectSearch({ q: /^flux capacitor$/i, result: "empty" });

  add("thinkpad-1", "product search", laptopPrompt, expectLaptop);
  add("headphones-1", "budget", headphonesPrompt, expectHeadphones);
  add("starter-1", "starter set", starterPrompt, expectStarter);
  add("gift-1", "clarification", giftPrompt, quickReply);
  add("flux-direct", "missing item", "Do you sell a flux capacitor?", expectFlux);
  add("backpack", "product search", "Find backpacks in the shop.", expectSearch({ q: /^backpacks?$/i }));
  add("headphones-2", "budget", headphonesPrompt, expectHeadphones);
  add("starter-2", "starter set", starterPrompt, expectStarter);
  add("gift-2", "clarification", giftPrompt, quickReply);
  add("thinkpad-2", "product search", laptopPrompt, expectLaptop);
  add("headphones-reworded", "budget", "Search the catalog for headphones priced below €80.", expectHeadphones);
  add("backpack-range", "budget", "Find backpacks that cost between €70 and €110.",
    expectSearch({ q: /^backpacks?$/i, minPrice: 7000, maxPrice: 11000, result: "either" }));
  add("mouse-upper-bound", "budget", "Which mice are at most 40 euros?",
    expectSearch({ q: /^(mouse|mice)$/i, maxPrice: 4000, result: "either" }));
  add("starter-explicit", "starter set", "Search the shop for products tagged starter-set.", expectStarter);
  add("flux-explicit", "missing item", "Search the catalog for a flux capacitor and show whether anything matches.", expectFlux);
  add("categories", "categories", "What shopping categories are available?", (turns, requests) => {
    const called = requests.some(({ endpoint, status }) => endpoint === "categories.list" && status === 200);
    const listed = turns.some(({ parts }) => parts.some((part) =>
      part.type === "tool-listCategories" && part.state === "output-available" &&
      part.output.categories.length === categories.length));
    if (!called || !listed) return "Expected a successful category lookup with all categories.";
  });
  add("browse-accessories", "categories", "Show me products in the Accessories category.",
    expectSearch({ category: accessories.id }));
  add("offers-direct", "offers", `Show all current offers for product ID ${laptop.id}.`, (turns, requests) => {
    const called = requests.some(({ endpoint, status, input }) =>
      endpoint === "products.byId" && status === 200 && input?.id === laptop.id);
    const listed = turns.some(({ parts }) => parts.some((part) =>
      part.type === "tool-getOffers" && part.state === "output-available" &&
      part.output.product.id === laptop.id && part.output.offers.length > 0));
    if (!called || !listed) return "Expected real offers with the requested product ID.";
  });
  const missingProduct = "prd-missing-00000";
  add("offers-missing", "offers", `Check offers for product ID ${missingProduct}.`, (turns, requests) => {
    const called = requests.some(({ endpoint, status, input }) =>
      endpoint === "products.byId" && status === 404 && input?.id === missingProduct);
    const failed = turns.some(({ parts }) => parts.some((part) =>
      part.type === "tool-getOffers" && part.state === "output-error" && /no longer in the catalog/i.test(part.errorText)));
    if (!called || !failed) return "Expected a 404 and a structured tool error for the unknown product ID.";
  });

  const badVoucher = "DOESNOTEXIST2026";
  const expectCart = (voucherCode?: string): Scenario["check"] => (turns, requests) => {
    const called = requests.some(({ endpoint, status, input }) => {
      if (endpoint !== "cart.validate" || status !== 200 || input?.voucherCode !== voucherCode) return false;
      const items: unknown = input?.items;
      if (!Array.isArray(items) || items.length !== 1) return false;
      const item: unknown = items[0];
      return typeof item === "object" && item !== null && "offerId" in item && item.offerId === offer.id &&
        "quantity" in item && item.quantity === 1;
    });
    const validated = turns.some(({ parts }) => parts.some((part) =>
      part.type === "tool-validateCart" && part.state === "output-available" &&
      (voucherCode === undefined
        ? part.output.valid && part.output.totals.items === offer.price && part.output.totals.grand >= offer.price
        : part.output.issues.some(({ code }) => code === "VOUCHER_NOT_FOUND") && part.output.totals.discount === 0)));
    if (!called || !validated) return "Expected cart validation with the requested offer, quantity and voucher.";
  };
  add("cart-known-offer", "cart", `Validate my cart and show the total for 1 unit of offer ID ${offer.id}.`, expectCart());
  add("cart-bad-voucher", "cart", `Validate my cart for 1 unit of offer ${offer.id} with voucher ${badVoucher}.`, expectCart(badVoucher));
  add("gift-explicit", "clarification", "I want a gift for a new student. Ask me one clarifying question with options before you search.", quickReply);
  add("multi-turn-budget", "follow-up", ["Help me pick a backpack. Ask what I want to spend first.", "At most €100."], (turns, requests) =>
    quickReply(turns.slice(0, 1)) ?? expectSearch({ q: /^backpacks?$/i, maxPrice: 10000 })(turns.slice(1), requests));
  add("out-of-scope", "out of scope", "Write a Python web scraper for a completely different website.", (turns, requests) => {
    const reply = turns.flatMap(({ parts }) => parts.flatMap((part) => part.type === "text" ? [part.text] : [])).join("\n");
    if (requests.length || !/shop|catalog|assist/i.test(reply) || /import requests|def scrape/i.test(reply)) {
      return "Expected a plain-text redirect to shopping without a shop API call.";
    }
  });
  add("headphones-3", "budget", headphonesPrompt, expectHeadphones);
  add("starter-3", "starter set", starterPrompt, expectStarter);
  add("gift-3", "clarification", giftPrompt, quickReply);
  add("thinkpad-3", "product search", laptopPrompt, expectLaptop);
  return { scenarios, fixtures };
}
