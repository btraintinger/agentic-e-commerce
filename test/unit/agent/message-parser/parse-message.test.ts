import { expect, test, vi } from "vitest";
import type { LanguageModel } from "ai";
import { parseUserMessage } from "@/agent/message-parser/parse-message";
import type { ShopRequest } from "@/agent/types";

const { parseWithLlm } = vi.hoisted(() => ({ parseWithLlm: vi.fn() }));
vi.mock("@/agent/message-parser/llm-parser", () => ({ parseWithLlm }));

const model = {} as LanguageModel;

const llmRequest = (fields: Partial<ShopRequest>): ShopRequest => ({
  intent: "search",
  product: null,
  gender: null,
  quantity: null,
  minPriceEur: null,
  maxPriceEur: null,
  number: null,
  ...fields,
});

test("returns null when the LLM gives no valid request", async () => {
  parseWithLlm.mockResolvedValueOnce(null);
  expect(await parseUserMessage(model, "hello")).toBeNull();
});

test("corrects a wrong price direction from the LLM", async () => {
  parseWithLlm.mockResolvedValueOnce(
    llmRequest({ product: "T-Shirt", maxPriceEur: 100, quantity: 2, gender: "male" }),
  );

  const result = await parseUserMessage(
    model,
    "I want a T-Shirt that costs at least 100€",
  );

  expect(result).toEqual(
    llmRequest({ product: "T-Shirt", minPriceEur: 100 }),
  );
});
