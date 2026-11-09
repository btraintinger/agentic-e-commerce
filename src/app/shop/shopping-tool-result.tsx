import { ArrowRight, CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { ShoppingMessage } from "~/lib/shopping-agent";
import type { StockLevel } from "~/types";

import type { CartOffer } from "./shopping-cart";
import { price } from "./shopping-price";

const stockStatus = {
  NO: { label: "Out of stock", variant: "destructive" },
  LITTLE: { label: "Low stock", variant: "warning" },
  ALOT: { label: "In stock", variant: "success" },
} as const satisfies Record<StockLevel, { label: string; variant: string }>;

function StockBadge({ stock }: { stock: StockLevel }) {
  const { label, variant } = stockStatus[stock];
  return <Badge variant={variant}>{label}</Badge>;
}

function delivery({ min, max }: { min: number; max: number }) {
  if (min !== max) return `${min}–${max} days`;
  return min === 1 ? "1 day" : `${min} days`;
}

export function isStructuredShoppingResult(part: ShoppingMessage["parts"][number]) {
  return (
    (part.type === "tool-searchProducts" ||
      part.type === "tool-getOffers" ||
      part.type === "tool-askQuestion" ||
      part.type === "tool-validateCart") &&
    part.state === "output-available"
  );
}

export function isShoppingToolError(part: ShoppingMessage["parts"][number]) {
  return "state" in part && part.state === "output-error";
}

export function ShoppingToolResult({
  part,
  ask,
  addToCart,
  canSend,
  isLatest,
}: {
  part: ShoppingMessage["parts"][number];
  ask: (prompt: string) => void;
  addToCart: (offer: CartOffer) => void;
  canSend: boolean;
  isLatest: boolean;
}) {
  if ("state" in part && part.state === "output-error") {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertTitle>A shopping tool couldn’t finish</AlertTitle>
        <AlertDescription>{part.errorText}</AlertDescription>
      </Alert>
    );
  }

  if (part.type === "tool-searchProducts" && part.state === "output-available") {
    const { products, total } = part.output;

    return (
      <section className="@container grid min-w-0 gap-3">
        <header className="grid gap-1">
          <h2 className="text-lg leading-snug font-semibold">{total === 1 ? "1 catalog match" : `${total} catalog matches`}</h2>
          <p className="max-w-[68ch] text-sm text-muted-foreground">
            {total === 0
              ? "Try a broader search or a different price range."
              : total > products.length
                ? `Showing the first ${products.length}. Pick a product to see its offers.`
                : "Pick a product to see its offers."}
          </p>
        </header>
        {products.length > 0 && (
          <ul className="grid gap-3 @lg:grid-cols-2">
            {products.map((product) => (
              <li key={product.id} className="min-w-0">
                <Card className="h-full">
                  <CardHeader>
                    <h3 className="text-base leading-snug font-semibold wrap-anywhere">{product.name}</h3>
                    <CardDescription className="leading-relaxed wrap-anywhere">
                      {product.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    <StockBadge stock={product.stock} />
                  </CardContent>
                  <CardFooter className="mt-auto flex-wrap justify-between gap-2">
                    <span className="font-semibold tabular-nums">From {price(product.price)}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-10"
                      disabled={!canSend}
                      aria-label={`See offers for ${product.name}`}
                      onClick={() =>
                        ask(`Show offers for ${product.name} (product ID ${product.id}).`)
                      }
                    >
                      See offers <ArrowRight aria-hidden data-icon="inline-end" />
                    </Button>
                  </CardFooter>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (part.type === "tool-getOffers" && part.state === "output-available") {
    const { product, offers } = part.output;

    return (
      <section className="@container grid min-w-0 gap-3">
        <header className="grid gap-1">
          <h2 className="text-lg leading-snug font-semibold wrap-anywhere">{product.name}</h2>
          <p className="max-w-[68ch] text-sm text-muted-foreground">
            {offers.length
              ? "Offer prices exclude shipping charges and any package tax."
              : "There are currently no offers for this product."}
          </p>
        </header>
        {offers.length > 0 && (
          <ul className="grid gap-3 @lg:grid-cols-2">
            {offers.map((offer) => (
              <li key={offer.id} className="min-w-0">
                <Card className="h-full">
                  <CardHeader>
                    <h3 className="text-base leading-snug font-semibold wrap-anywhere">{offer.variant}</h3>
                    <CardDescription className="wrap-anywhere">
                      {offer.vendor} · {delivery(offer.deliveryDays)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm leading-relaxed text-muted-foreground">
                    <p>
                      {offer.shippingCost === 0
                        ? "Free shipping"
                        : `${price(offer.shippingCost)} shipping per item`}
                    </p>
                    {offer.freeShippingThreshold !== undefined && (
                      <p>Free shipping from {price(offer.freeShippingThreshold)} per shipment</p>
                    )}
                  </CardContent>
                  <CardFooter className="mt-auto flex-col items-stretch gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xl leading-tight font-semibold tabular-nums">{price(offer.price)}</span>
                      <StockBadge stock={offer.stock} />
                    </div>
                    {offer.stock !== "NO" && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-10"
                          aria-label={`Add to cart: ${product.name}, ${offer.variant}, from ${offer.vendor}, ${price(offer.price)}`}
                          onClick={() => addToCart({
                            id: offer.id,
                            productName: product.name,
                            variant: offer.variant,
                            vendor: offer.vendor,
                            price: offer.price,
                          })}
                        >
                          Add to cart
                        </Button>
                      </div>
                    )}
                  </CardFooter>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (part.type === "tool-askQuestion" && part.state === "output-available") {
    const { question, options } = part.output;

    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>{question}</CardTitle>
          {isLatest && <CardDescription>Choose an answer or type your own.</CardDescription>}
        </CardHeader>
        {isLatest && (
          <CardContent className="flex flex-wrap gap-2">
            {options.map((option) => (
              <Button
                key={option}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto min-h-9 max-w-full whitespace-normal"
                disabled={!canSend}
                onClick={() => ask(option)}
              >
                {option}
              </Button>
            ))}
          </CardContent>
        )}
      </Card>
    );
  }

  if (part.type === "tool-validateCart" && part.state === "output-available") {
    const { valid, issues, totals, deliveryDays, packageCount } = part.output;

    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>{valid ? "Cart estimate" : "Cart needs attention"}</CardTitle>
          <CardDescription>
            {packageCount === 1 ? "1 package" : `${packageCount} packages`}
            {deliveryDays && ` · Delivery in ${delivery(deliveryDays)}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm tabular-nums">
            <dt>Items</dt>
            <dd className="text-right">{price(totals.items)}</dd>
            <dt>Shipping and package tax</dt>
            <dd className="text-right">{price(totals.shipping)}</dd>
            <dt>Discount</dt>
            <dd className="text-right">{price(totals.discount)}</dd>
            <dt className="border-t border-border pt-1 font-semibold">Total</dt>
            <dd className="border-t border-border pt-1 text-right font-semibold">{price(totals.grand)}</dd>
          </dl>
          {issues.length > 0 && (
            <ul className="ml-4 list-disc text-sm text-destructive">
              {issues.map((issue, index) => <li key={index}>{issue.message}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
