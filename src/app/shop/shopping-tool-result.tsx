import { ArrowRight, CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { ShoppingMessage } from "~/lib/shopping-agent";
import type { StockLevel } from "~/types";

const euro = new Intl.NumberFormat("en-AT", {
  style: "currency",
  currency: "EUR",
});

const stockLabels: Record<StockLevel, string> = {
  NO: "Out of stock",
  LITTLE: "Low stock",
  ALOT: "In stock",
};

function price(cents: number) {
  return euro.format(cents / 100);
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
  canSend,
  isLatest,
}: {
  part: ShoppingMessage["parts"][number];
  ask: (prompt: string) => void;
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
      <Card size="sm">
        <CardHeader>
          <CardTitle>{total === 1 ? "1 catalog match" : `${total} catalog matches`}</CardTitle>
          <CardDescription>
            {total === 0
              ? "Try a broader search or a different price range."
              : total > products.length
                ? `Showing the first ${products.length}. Pick a product to see its offers.`
                : "Pick a product to see its offers."}
          </CardDescription>
        </CardHeader>
        {products.length > 0 && (
          <CardContent>
            <ul className="divide-y divide-border border-y">
              {products.map((product) => (
                <li
                  key={product.id}
                  className="grid min-w-0 items-center gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm leading-snug font-medium wrap-anywhere">{product.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground wrap-anywhere">
                      {product.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium tabular-nums">From {price(product.price)}</span>
                      <Badge variant="secondary">{stockLabels[product.stock]}</Badge>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-9 w-fit"
                    disabled={!canSend}
                    aria-label={`See offers for ${product.name}`}
                    onClick={() =>
                      ask(`Show offers for ${product.name} (product ID ${product.id}).`)
                    }
                  >
                    See offers <ArrowRight aria-hidden data-icon="inline-end" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    );
  }

  if (part.type === "tool-getOffers" && part.state === "output-available") {
    const { product, offers } = part.output;

    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>{product.name}</CardTitle>
          <CardDescription>
            {offers.length
              ? "Offer prices exclude shipping charges and any package tax."
              : "There are currently no offers for this product."}
          </CardDescription>
        </CardHeader>
        {offers.length > 0 && (
          <CardContent>
            <ul className="divide-y divide-border border-y">
              {offers.map((offer) => (
                <li key={offer.id} className="flex flex-wrap justify-between gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium wrap-anywhere">{offer.variant}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground wrap-anywhere">
                      {offer.vendor} · {delivery(offer.deliveryDays)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {offer.shippingCost === 0
                        ? "Free shipping"
                        : `${price(offer.shippingCost)} shipping per item`}
                      {offer.freeShippingThreshold !== undefined &&
                        ` · Free shipping from ${price(offer.freeShippingThreshold)} per shipment`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">{price(offer.price)}</span>
                    <Badge variant="secondary">{stockLabels[offer.stock]}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
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
            <dt className="border-t pt-1 font-semibold">Total</dt>
            <dd className="border-t pt-1 text-right font-semibold">{price(totals.grand)}</dd>
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
