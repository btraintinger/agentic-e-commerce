"use client";

import { useChat } from "@ai-sdk/react";
import { isToolUIPart } from "ai";
import {
  ArrowDownRight,
  ArrowUp,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  ShoppingBag,
  Square,
} from "lucide-react";
import {
  Fragment,
  type FormEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Bubble, BubbleContent } from "~/components/ui/bubble";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
  shoppingModel,
  type ShoppingMessage,
  supportsShoppingModel,
} from "~/lib/shopping-agent";

import { type CartItem, type CartOffer, ShoppingCartDrawer } from "./shopping-cart";
import {
  isShoppingToolError,
  isStructuredShoppingResult,
  ShoppingToolResult,
} from "./shopping-tool-result";
import { groupShoppingParts, ShoppingToolTrace } from "./shopping-tool-trace";

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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
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
    lastMessage.parts.some(isToolUIPart);

  function addToCart(offer: CartOffer) {
    setCartItems((items) =>
      items.some((item) => item.id === offer.id)
        ? items.map((item) =>
            item.id === offer.id ? { ...offer, quantity: item.quantity + 1 } : item,
          )
        : [...items, { ...offer, quantity: 1 }],
    );
  }

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
    <main className="min-h-dvh">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[57rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 sm:px-8">
          <span className="inline-flex min-h-10 items-center gap-2.5 text-sm font-semibold">
            <span className="grid size-9 place-items-center rounded-lg border border-input text-primary">
              <ShoppingBag aria-hidden className="size-5" />
            </span>
            JKU Webshop
          </span>
          <ShoppingCartDrawer
            items={cartItems}
            onRemove={(id) => setCartItems((items) => items.filter((item) => item.id !== id))}
          />
        </div>
      </header>

      <div className="mx-auto max-w-[57rem] px-4 py-5 sm:px-8 sm:py-8">
        <section
          aria-labelledby="shop-title"
          className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground"
        >
          <div className="border-b border-border bg-secondary px-4 py-4 sm:px-8">
            <h1 id="shop-title" className="text-base font-semibold tracking-tight">
              Campus shopping desk
            </h1>
          </div>

          <MessageScrollerProvider autoScroll defaultScrollPosition="start">
            <MessageScroller className="relative h-[clamp(22rem,56dvh,44rem)] min-w-0">
              <MessageScrollerViewport className="h-full" aria-label="Conversation">
                <MessageScrollerContent aria-live="off" className="gap-6 px-4 py-6 sm:px-8 sm:py-8">
                  {messages.length === 0 ? (
                    <MessageScrollerItem className="my-auto">
                      <div className="flex flex-col gap-6">
                        <div>
                          <h2 className="text-balance text-3xl leading-tight font-semibold tracking-tight">
                            What are you shopping for?
                          </h2>
                          <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-muted-foreground">
                            Tell me what you need or how much you want to spend.
                            I’ll look through the JKU catalog for you.
                          </p>
                        </div>
                        <div className="flex flex-col items-start gap-3">
                          <p className="text-xs text-muted-foreground">
                            Your first message starts a large model download.
                          </p>
                          <div className="flex flex-wrap gap-2" role="group" aria-label="Example requests">
                            {startingPoints.map(({ label, prompt }) => (
                              <Button
                                key={label}
                                variant="outline"
                                size="sm"
                                className="h-auto min-h-10 max-w-full whitespace-normal"
                                disabled={!canSend}
                                onClick={() => ask(prompt)}
                              >
                                <ArrowDownRight aria-hidden data-icon="inline-start" />
                                {label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </MessageScrollerItem>
                  ) : (
                    messages.map((message) => {
                      const isLatest = message.id === lastMessage?.id;
                      const showText = message.role === "user" ||
                        (!(busy && isLatest) && !message.parts.some(isStructuredShoppingResult));
                      const visibleParts = groupShoppingParts(message.parts, showText);
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
                                if (!Array.isArray(part)) {
                                  const body = (
                                    <p className="max-w-[68ch] whitespace-pre-wrap wrap-anywhere">
                                      {part.text}
                                    </p>
                                  );
                                  return message.role === "user" ? (
                                    <Bubble key={index} variant="tinted">
                                      <BubbleContent>{body}</BubbleContent>
                                    </Bubble>
                                  ) : (
                                    <div key={index}>{body}</div>
                                  );
                                }
                                return (
                                  <Fragment key={part[0].toolCallId}>
                                    <ShoppingToolTrace parts={part} running={busy && isLatest} />
                                    {part
                                      .filter((tool) => isStructuredShoppingResult(tool) || isShoppingToolError(tool))
                                      .map((tool) => (
                                        <ShoppingToolResult
                                          key={tool.toolCallId}
                                          part={tool}
                                          ask={ask}
                                          addToCart={addToCart}
                                          canSend={canSend}
                                          isLatest={isLatest}
                                        />
                                      ))}
                                  </Fragment>
                                );
                              })}
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      );
                    })
                  )}
                  {busy && !loadingModel && !hasAssistantOutput && (
                    <MessageScrollerItem>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" />
                        Preparing a reply…
                      </div>
                    </MessageScrollerItem>
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton aria-label="Jump to latest message" behavior="auto" />
            </MessageScroller>
          </MessageScrollerProvider>

          <div className="flex flex-col gap-3 border-t border-border bg-muted px-4 py-4 sm:px-8">
            <span className="sr-only" role="status">{announcement}</span>
            {loadingModel && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" />
                <span>Preparing the local model…{progress !== null && ` ${progress}%`}</span>
              </div>
            )}
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
                    <InputGroupAddon align="block-end" className="flex-wrap justify-between border-t border-border">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Local model, ${shoppingModel.label}`}
                          render={<InputGroupButton size="sm" variant="outline" className="min-h-10" />}
                        >
                          {shoppingModel.label}
                          <ChevronDown aria-hidden data-icon="inline-end" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="top">
                          <DropdownMenuRadioGroup value={shoppingModel.id}>
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>Local model</DropdownMenuLabel>
                              <DropdownMenuRadioItem value={shoppingModel.id} closeOnClick>
                                {shoppingModel.label}
                              </DropdownMenuRadioItem>
                            </DropdownMenuGroup>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
      </div>
    </main>
  );
}
