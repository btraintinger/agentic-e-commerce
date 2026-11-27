/**
 * Entry point of the message parser ("checks & balances"):
 * the LLM proposes a ShopRequest, llm-corrections correct the numeric fields.
 */

import type { LanguageModel } from "ai";
import type { ShopRequest } from "@/agent/types";
import { applyLlmCorrections } from "./llm-corrections";
import { parseWithLlm } from "./llm-parser";

export async function parseUserMessage(
  model: LanguageModel,
  message: string,
): Promise<ShopRequest | null> {
  const llmRequest = await parseWithLlm(model, message);
  if (!llmRequest) return null;
  return applyLlmCorrections(llmRequest, message);
}
