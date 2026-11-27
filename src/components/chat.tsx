"use client";

import { doesBrowserSupportWebLLM, webLLM } from "@browser-ai/web-llm";
import { useQueryClient } from "@tanstack/react-query";
import { generateText } from "ai";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type SubmitEvent,
} from "react";
import { ShoppingAgent } from "@/agent/shopping-agent";
import type { ProductOption, ShopResponse } from "@/agent/types";
import { useCart } from "@/components/cart-provider";
import { formatCents } from "@/components/format";
import { useTRPC } from "@/trpc/client";

const noSubscription = () => () => {};

export const modelId = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

type Message = { role: "user" } & Pick<ShopResponse, "text">;
type Entry = Message | ({ role: "assistant" } & ShopResponse);

export function Chat() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const cart = useCart();
  const { lines, add, remove } = cart;
  const [progress, setProgress] = useState<string | null>(null);
  // Node.js also has a global navigator (without gpu), so check only in the browser.
  const supported = useSyncExternalStore(
    noSubscription,
    doesBrowserSupportWebLLM,
    () => true,
  );
  const [model] = useState(() =>
    webLLM(modelId, {
      initProgressCallback: (report) =>
        setProgress(report.progress < 1 ? report.text : null),
    }),
  );
  // The cart controls read the latest state through a ref, so one agent keeps its shown options.
  const [agent] = useState(
    () => new ShoppingAgent(model, trpc, queryClient, { lines, add, remove }),
  );
  const warmUp = useRef<Promise<void> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  useEffect(() => {
    if (!supported || warmUp.current) return;
    warmUp.current = generateText({
      model,
      prompt: "Hi",
      maxOutputTokens: 1,
    }).then(
      () => setModelReady(true),
      (error: unknown) => {
        console.error(error);
        setProgress(null);
        setLoadFailed(true);
      },
    );
  }, [model, supported]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const reply = (entry: Entry) => setEntries((list) => [...list, entry]);

  async function send(event: SubmitEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    reply({ role: "user", text });
    setBusy(true);
    try {
      await warmUp.current;
      reply({ role: "assistant", ...(await agent.handleMessage(text)) });
    } finally {
      setBusy(false);
    }
  }

  const pick = (option: ProductOption) =>
    reply({ role: "assistant", text: agent.addOption(option) });

  return (
    <section
      data-testid="chat"
      data-model-ready={modelReady}
      className="flex min-h-[70vh] flex-col gap-3 rounded-lg border p-4"
    >
      <h2 className="font-semibold">Chat</h2>
      {!supported && (
        <p className="text-sm text-destructive">
          Your browser does not support WebGPU, so the chat model cannot run
          here.
        </p>
      )}
      <ol
        data-testid="chat-log"
        className="flex flex-1 flex-col gap-3 overflow-y-auto"
      >
        {entries.map((entry, index) => (
          <li
            key={index}
            data-testid="chat-entry"
            data-role={entry.role}
            className={
              entry.role === "user"
                ? "self-end rounded-lg bg-muted px-3 py-2 text-sm"
                : "self-start text-sm"
            }
          >
            <p>{entry.text}</p>
            {entry.role === "assistant" && entry.options && (
              <ol className="mt-2 flex flex-col gap-1">
                {entry.options.map((option) => (
                  <li key={option.offerId}>
                    <button
                      type="button"
                      className="w-full rounded-md border px-3 py-2 text-left hover:bg-muted"
                      onClick={() => pick(option)}
                    >
                      <span className="font-medium">No. {option.number}</span>{" "}
                      {option.name} · {option.variantName} ·{" "}
                      {formatCents(option.price)}
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {entry.role === "assistant" && entry.request && (
              <details className="mt-1 text-xs text-muted-foreground">
                <summary>Recognised request</summary>
                <pre
                  data-testid="recognised-request"
                  className="whitespace-pre-wrap"
                >
                  {JSON.stringify(entry.request, null, 2)}
                </pre>
              </details>
            )}
          </li>
        ))}
        {loadFailed && (
          <li className="text-sm text-destructive">
            The model could not be loaded.
          </li>
        )}
        {progress !== null && (
          <li className="text-sm text-muted-foreground">
            Loading model: {progress}
          </li>
        )}
        {busy && progress === null && (
          <li className="text-sm text-muted-foreground">
            Recognising your request…
          </li>
        )}
      </ol>
      <form onSubmit={(event) => void send(event)} className="flex gap-2">
        <input
          data-testid="chat-input"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          placeholder="e.g. I need a rain jacket for men under €150"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={!supported}
        />
        <button
          type="submit"
          data-testid="chat-send"
          className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
          disabled={!supported || busy || !input.trim()}
        >
          Send
        </button>
      </form>
    </section>
  );
}
