import { readUIMessageStream } from "ai";

import { createShoppingTransport, type ShoppingMessage } from "../../src/lib/shopping-agent";

export interface Turn {
  prompt: string;
  durationMs: number;
  parts: ShoppingMessage["parts"];
  errors: string[];
}

async function runShoppingConversation(prompts: string[], timeoutMs: number): Promise<Turn[]> {
  const transport = createShoppingTransport();
  const chatId = crypto.randomUUID();
  const messages: ShoppingMessage[] = [];
  const turns: Turn[] = [];

  for (const prompt of prompts) {
    const started = performance.now();
    const errors: string[] = [];
    const abortSignal = AbortSignal.timeout(timeoutMs);
    const messageId = crypto.randomUUID();
    messages.push({ id: messageId, role: "user", parts: [{ type: "text", text: prompt }] });
    const stream = await transport.sendMessages({
      trigger: "submit-message",
      chatId,
      messageId,
      messages,
      abortSignal,
    });
    let response: ShoppingMessage | undefined;
    for await (const message of readUIMessageStream<ShoppingMessage>({
      stream,
      onError: (error) => errors.push(error instanceof Error ? error.message : String(error)),
    })) {
      response = message;
    }
    if (abortSignal.aborted) errors.push("Model turn timed out.");
    if (response) messages.push(response);
    turns.push({ prompt, durationMs: Math.round(performance.now() - started), parts: response?.parts ?? [], errors });
  }

  return turns;
}

declare global {
  interface Window {
    runShoppingConversation: typeof runShoppingConversation;
  }
}

window.runShoppingConversation = runShoppingConversation;
