"use client";

import { useChat } from "@ai-sdk/react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUp,
  CircleAlert,
  Cpu,
  LoaderCircle,
  PackageSearch,
  ShoppingBag,
  Square,
} from "lucide-react";
import Link from "next/link";
import {
  type FormEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Bubble, BubbleContent } from "~/components/ui/bubble";
import { Button } from "~/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "~/components/ui/input-group";
import {
  Message,
  MessageContent,
  MessageHeader,
} from "~/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "~/components/ui/message-scroller";
import {
  createShoppingTransport,
  type ShoppingMessage,
  supportsShoppingModel,
} from "~/lib/shopping-agent";

import styles from "./desk.module.css";
import {
  isShoppingToolError,
  isStructuredShoppingResult,
  ShoppingToolResult,
} from "./shopping-tool-result";

const startingPoints = [
  {
    label: "Find a campus backpack",
    prompt: "Find me a backpack under €100 that can carry a 15-inch laptop.",
  },
  {
    label: "Browse the JKU Starter Set",
    prompt: "Show me some products in the JKU Starter Set.",
  },
  {
    label: "Compare headphones",
    prompt: "Help me compare headphones for studying in the library.",
  },
];

const subscribeToModelSupport = () => () => undefined;
const getServerModelSupport = () => null;

export function ShoppingAssistant() {
  const [transport] = useState(createShoppingTransport);
  const [draft, setDraft] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const composer = useRef<HTMLTextAreaElement>(null);
  const modelSupported = useSyncExternalStore(
    subscribeToModelSupport,
    supportsShoppingModel,
    getServerModelSupport,
  );
  const { messages, sendMessage, status, stop, error, regenerate } =
    useChat<ShoppingMessage>({
      transport,
      onData: (part) => {
        if (part.type === "data-modelProgress") {
          setProgress(Math.max(0, Math.min(100, Math.round(part.data.progress * 100))));
        }
      },
      onFinish: ({ isAbort, isError }) => {
        if (isAbort) setAnnouncement("Response stopped.");
        else if (!isError) setAnnouncement("The assistant has responded.");
      },
    });

  const busy = status === "submitted" || status === "streaming";
  const canSend = modelSupported === true && !busy;
  const ready = progress === 100;
  const loadingModel = busy && !ready;
  const lastMessage = messages.at(-1);
  const hasAssistantOutput =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some(
      (part) => isStructuredShoppingResult(part) || isShoppingToolError(part),
    );

  function ask(prompt: string) {
    const text = prompt.trim();
    if (canSend && text) {
      setAnnouncement("The assistant is working.");
      void sendMessage({ text });
      composer.current?.focus();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSend && draft.trim()) {
      ask(draft);
      setDraft("");
    }
  }

  return (
    <main className={styles.desk + " min-h-dvh bg-background text-foreground"}>
      <header className="border-b border-primary bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-[75rem] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2.5 rounded-md font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <ShoppingBag aria-hidden className="size-5 text-(--desk-mark)" />
            JKU Webshop
          </Link>
          <span className="text-sm font-medium">Shopping assistant</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-[75rem] gap-6 px-4 py-5 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-8">
        <section
          aria-labelledby="shop-title"
          className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground"
        >
          <div className="border-b px-5 py-4 sm:px-8">
            <h1 id="shop-title" className="text-xl font-semibold tracking-tight">
              Campus shopping desk
            </h1>
          </div>

          <MessageScrollerProvider autoScroll defaultScrollPosition="start">
            <MessageScroller className="relative h-[clamp(22rem,56dvh,44rem)] min-w-0">
              <MessageScrollerViewport className="h-full" aria-label="Conversation">
                <MessageScrollerContent aria-live="off" className="gap-6 px-5 py-6 sm:px-8 sm:py-8">
                  {messages.length === 0 ? (
                    <MessageScrollerItem>
                      <div className="flex max-w-xl flex-col gap-6">
                        <div>
                          <h2 className="max-w-[18ch] text-balance text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
                            What are you shopping for?
                          </h2>
                          <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
                            Tell me what you need or how much you want to spend.
                            I’ll look through the JKU catalog for you.
                          </p>
                        </div>
                        <div className="flex flex-col items-start gap-2" role="group" aria-label="Example requests">
                          <p className="text-xs text-muted-foreground">
                            Your first message starts a large model download.
                          </p>
                          {startingPoints.map(({ label, prompt }) => (
                            <Button
                              key={label}
                              variant="outline"
                              className="min-h-10 max-w-full justify-start"
                              disabled={!canSend}
                              onClick={() => ask(prompt)}
                            >
                              <ArrowDownRight aria-hidden data-icon="inline-start" />
                              {label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </MessageScrollerItem>
                  ) : (
                    messages.map((message) => {
                      const isLatest = message.id === lastMessage?.id;
                      const showText = message.role === "user" ||
                        (!(busy && isLatest) && !message.parts.some(isStructuredShoppingResult));
                      const visibleParts = message.parts.filter((part) =>
                        part.type === "text"
                          ? showText && part.text.trim()
                          : isStructuredShoppingResult(part) || isShoppingToolError(part),
                      );
                      if (visibleParts.length === 0) return null;

                      return (
                        <MessageScrollerItem
                          key={message.id}
                          messageId={message.id}
                          scrollAnchor={message.role === "user"}
                        >
                          <Message align={message.role === "user" ? "end" : "start"}>
                            <MessageContent className="w-full min-w-0 gap-3">
                              <MessageHeader className="px-0">
                                {message.role === "user" ? "You" : "Shopping assistant"}
                              </MessageHeader>
                              {visibleParts.map((part, index) => {
                                if (part.type === "text") {
                                  const body = (
                                    <p className="max-w-[68ch] whitespace-pre-wrap wrap-anywhere">
                                      {part.text}
                                    </p>
                                  );
                                  return message.role === "user" ? (
                                    <Bubble key={index}>
                                      <BubbleContent>{body}</BubbleContent>
                                    </Bubble>
                                  ) : (
                                    <div key={index}>{body}</div>
                                  );
                                }
                                return (
                                  <ShoppingToolResult
                                    key={index}
                                    part={part}
                                    ask={ask}
                                    canSend={canSend}
                                    isLatest={isLatest}
                                  />
                                );
                              })}
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      );
                    })
                  )}
                  {busy && !hasAssistantOutput && (
                    <MessageScrollerItem>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" />
                        {loadingModel ? "Preparing the local model…" : "Preparing a reply…"}
                      </div>
                    </MessageScrollerItem>
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton aria-label="Jump to latest message" behavior="auto" />
            </MessageScroller>
          </MessageScrollerProvider>

          <div className="flex flex-col gap-3 border-t px-5 py-4 sm:px-8">
            <span className="sr-only" role="status">{announcement}</span>
            {modelSupported === false && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertTitle>WebGPU is unavailable</AlertTitle>
                <AlertDescription>
                  Open the shopping desk in a browser with WebGPU enabled.
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertTitle>Couldn’t complete the request</AlertTitle>
                <AlertDescription>
                  <p className="wrap-anywhere">{error.message}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canSend}
                    onClick={() => {
                      setAnnouncement("The assistant is working.");
                      void regenerate();
                      composer.current?.focus();
                    }}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <form noValidate onSubmit={submit}>
              <FieldGroup>
                <Field>
                  <FieldLabel className="sr-only" htmlFor="shopping-prompt">
                    Ask about a product
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupTextarea
                      id="shopping-prompt"
                      ref={composer}
                      value={draft}
                      onChange={(event) => setDraft(event.currentTarget.value)}
                      disabled={modelSupported !== true}
                      maxLength={2000}
                      rows={2}
                      className="max-h-40"
                      placeholder="Ask about a product, price, or delivery…"
                      aria-describedby="composer-help"
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                    <InputGroupAddon align="block-end" className="justify-end">
                      {busy ? (
                        <InputGroupButton
                          type="button"
                          variant="default"
                          className="min-h-10 min-w-20"
                          onClick={() => void stop()}
                        >
                          <Square aria-hidden data-icon="inline-start" />
                          Stop
                        </InputGroupButton>
                      ) : (
                        <InputGroupButton
                          type="submit"
                          variant="default"
                          className="min-h-10 min-w-20"
                          disabled={!canSend || !draft.trim()}
                        >
                          <ArrowUp aria-hidden data-icon="inline-start" />
                          Send
                        </InputGroupButton>
                      )}
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              </FieldGroup>
            </form>
            <p id="composer-help" className="text-xs leading-relaxed text-muted-foreground">
              {ready
                ? "Shift + Enter adds a new line."
                : "Your first message downloads the model files for this browser."}
            </p>
          </div>
        </section>

        <aside aria-labelledby="local-model-title" className="flex min-w-0 flex-col gap-5 self-start">
          <section className="flex flex-col gap-3 border-y py-5">
            <div className="flex items-center justify-between gap-2">
              <h2 id="local-model-title" className="flex items-center gap-2 text-sm font-semibold">
                <Cpu aria-hidden className="size-4 text-muted-foreground" />
                Local model
              </h2>
              <Badge variant="secondary">
                {modelSupported === false ? "Unavailable" : ready ? "Ready" : loadingModel ? "Loading" : "WebLLM"}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The AI runs on this device. Product and offer searches use the
              webshop API.
            </p>
            {loadingModel && (
              <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                <label htmlFor="model-progress">
                  {progress === null ? "Starting model setup" : `Preparing model · ${progress}%`}
                </label>
                <progress
                  id="model-progress"
                  className="h-2 w-full accent-primary"
                  max={100}
                  value={progress ?? undefined}
                />
              </div>
            )}
          </section>
          <section className="flex flex-col gap-2 pb-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <PackageSearch aria-hidden className="size-4 text-muted-foreground" />
              Catalog results
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Pick a product in the conversation to check its current offers,
              stock, and delivery estimates.
            </p>
            <Link
              href="/"
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md text-sm font-medium text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Webshop home <ArrowRight aria-hidden className="size-4" />
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
