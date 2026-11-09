import { TRPCClientError } from "@trpc/client";
import { CircleAlert, ShoppingCart, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { createWebshopClient } from "~/lib/webshop-client";
import type { CartIssueCode, ValidateResponse } from "~/types";

import styles from "./desk.module.css";
import { price } from "./shopping-price";

export type CartOffer = {
  id: string;
  productName: string;
  variant: string;
  vendor: string;
  price: number;
};

export type CartItem = CartOffer & { quantity: number };

type Estimate = { result: ValidateResponse } | { error: string };

const estimateFreshnessMs = 60_000;

function useCartEstimate(open: boolean, items: CartItem[], voucherCode: string) {
  const [client] = useState(createWebshopClient);
  const [revision, refresh] = useReducer((previous: number) => previous + 1, 0);
  const request = useMemo(() => ({
    revision,
    input: {
      items: items.map(({ id, quantity }) => ({ offerId: id, quantity })),
      ...(voucherCode && { voucherCode }),
    },
  }), [items, revision, voucherCode]);
  const [completed, setCompleted] = useState<{
    request: typeof request;
    estimate: Estimate;
    checkedAt: number;
  }>();
  const current = completed?.request === request ? completed : undefined;

  useEffect(() => {
    if (!open || request.input.items.length === 0 || current) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
      void client.cart.validate.mutate(request.input, { signal }).then(
        (result) => {
          if (!controller.signal.aborted) {
            setCompleted({ request, estimate: { result }, checkedAt: Date.now() });
          }
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          const rateLimited =
            error instanceof TRPCClientError && error.data?.code === "TOO_MANY_REQUESTS";
          setCompleted({
            request,
            checkedAt: Date.now(),
            estimate: {
              error: rateLimited
                ? "Too many cart checks. Wait a minute and try again."
                : "Couldn’t calculate the cart total. Try again.",
            },
          });
        },
      );
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [client, current, open, request]);

  function refreshOnOpen() {
    if (current && ("error" in current.estimate || Date.now() - current.checkedAt >= estimateFreshnessMs)) {
      refresh();
    }
  }

  return { estimate: current?.estimate, refresh, refreshOnOpen };
}

const voucherIssueText: Partial<Record<CartIssueCode, string>> = {
  VOUCHER_NOT_FOUND: "This voucher code was not found.",
  VOUCHER_EXPIRED: "This voucher has expired.",
  VOUCHER_MIN_ORDER_NOT_MET: "Your cart subtotal is below this voucher’s minimum.",
};

export function ShoppingCartDrawer({
  items,
  onRemove,
}: {
  items: CartItem[];
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [voucherDraft, setVoucherDraft] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const voucherInput = useRef<HTMLInputElement>(null);
  const { estimate, refresh, refreshOnOpen } = useCartEstimate(open, items, voucherCode);
  const result = estimate && "result" in estimate ? estimate.result : undefined;
  const quotedItems = new Map(result?.shipments.flatMap((shipment) =>
    shipment.items.map((item) => [item.offerId, item] as const),
  ));
  const itemIssues = new Map(result?.issues.flatMap((issue) =>
    issue.offerId === undefined ? [] : [[issue.offerId, issue.code] as const],
  ));
  const voucherIssue = result?.issues.find(({ offerId }) => offerId === undefined);
  const voucherError = voucherIssue && voucherIssueText[voucherIssue.code];
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const countLabel = count === 1 ? "1 item" : `${count} items`;
  const nextVoucher = voucherDraft.trim();

  function applyVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nextVoucher) setVoucherCode(nextVoucher);
  }

  function clearVoucher() {
    setVoucherDraft("");
    setVoucherCode("");
    voucherInput.current?.focus();
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (nextOpen) refreshOnOpen();
    }}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" className="min-h-10" aria-label={`Cart, ${countLabel}`}>
          <ShoppingCart aria-hidden data-icon="inline-start" />
          Cart
          <Badge variant="secondary" aria-hidden className="min-w-6 justify-center tabular-nums">
            {count}
          </Badge>
        </Button>
      </SheetTrigger>
      <span className="sr-only" role="status">{countLabel} in your cart.</span>
      <SheetContent
        showCloseButton={false}
        className={`${styles.desk} gap-0 bg-card text-card-foreground shadow-none data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:md:max-w-md`}
      >
        <SheetHeader className="shrink-0 flex-row items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-1">
            <SheetTitle>Your cart</SheetTitle>
            <SheetDescription>{countLabel}</SheetDescription>
          </div>
          <SheetClose asChild>
            <Button type="button" variant="ghost" size="icon" className="size-10" aria-label="Close cart">
              <X aria-hidden />
            </Button>
          </SheetClose>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {items.length === 0 ? (
            <div className="flex flex-col gap-1 px-5 py-6 sm:px-6">
              <p className="font-medium">Your cart is empty.</p>
              <p className="text-sm text-muted-foreground">Select Add to cart on an offer to put it here.</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border px-5 sm:px-6">
                {items.map((item) => {
                  const unitPrice = quotedItems.get(item.id)?.unitPrice ?? item.price;
                  const issue = itemIssues.get(item.id);
                  return (
                    <li key={item.id} className="flex flex-col gap-2 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-sm font-semibold wrap-anywhere">{item.productName}</h3>
                        {!issue && (
                          <p className="shrink-0 text-sm font-semibold tabular-nums">{price(unitPrice * item.quantity)}</p>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground wrap-anywhere">{item.variant} · {item.vendor}</p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground tabular-nums">
                          Qty {item.quantity}{!issue && ` · ${price(unitPrice)} each`}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-9"
                          aria-label={`Remove ${item.productName}, ${item.variant}, from ${item.vendor}`}
                          onClick={() => onRemove(item.id)}
                        >
                          Remove
                        </Button>
                      </div>
                      {issue && (
                        <p className="text-sm text-destructive">
                          {issue === "OUT_OF_STOCK" ? "This quantity is unavailable." : "This offer is unavailable."}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              <SheetFooter className="shrink-0 gap-4 border-t border-border px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                <form noValidate onSubmit={applyVoucher}>
                  <FieldGroup>
                    <Field data-invalid={Boolean(voucherError && nextVoucher === voucherCode)}>
                      <FieldLabel htmlFor="cart-voucher">Voucher code</FieldLabel>
                      <div className="flex items-center gap-2">
                        <Input
                          id="cart-voucher"
                          ref={voucherInput}
                          className="h-9"
                          value={voucherDraft}
                          onChange={(event) => setVoucherDraft(event.currentTarget.value)}
                          maxLength={100}
                          autoComplete="off"
                          spellCheck={false}
                          aria-invalid={Boolean(voucherError && nextVoucher === voucherCode)}
                          aria-describedby={voucherError ? "cart-voucher-error" : undefined}
                        />
                        <Button type="submit" variant="outline" className="min-h-9" disabled={!nextVoucher || nextVoucher === voucherCode}>
                          Apply
                        </Button>
                        {voucherCode && (
                          <Button type="button" variant="ghost" className="min-h-9" onClick={clearVoucher}>
                            Clear
                          </Button>
                        )}
                      </div>
                      {voucherError && <FieldError id="cart-voucher-error">{voucherError}</FieldError>}
                    </Field>
                  </FieldGroup>
                </form>
                <CartTotals subtotal={subtotal} estimate={estimate} excludedItems={itemIssues.size > 0} onRetry={refresh} />
              </SheetFooter>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CartTotals({
  subtotal,
  estimate,
  excludedItems,
  onRetry,
}: {
  subtotal: number;
  estimate?: Estimate;
  excludedItems: boolean;
  onRetry: () => void;
}) {
  const result = estimate && "result" in estimate ? estimate.result : undefined;
  const shipping = result?.shipments.reduce((total, shipment) => total + shipment.shippingCost, 0);
  const tax = result?.shipments.reduce((total, shipment) => total + shipment.packageTax, 0);
  const rows = [
    ["Items subtotal", result?.totals.items ?? subtotal],
    ["Shipping", shipping],
    ["Package tax", tax],
    ["Discount", result && 0 - result.totals.discount],
  ] as const;

  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 tabular-nums">
        {rows.map(([label, amount]) => (
          <div key={label} className="contents">
            <dt>{label}</dt>
            <dd className="text-right">{amount === undefined ? "—" : price(amount)}</dd>
          </div>
        ))}
        <div className="contents">
          <dt className="border-t border-border pt-2 font-semibold">
            {excludedItems ? "Total for available items" : "Total"}
          </dt>
          <dd className="border-t border-border pt-2 text-right font-semibold">
            {result ? price(result.totals.grand) : "—"}
          </dd>
        </div>
      </dl>
      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {result ? (
          excludedItems ? "The estimate excludes unavailable items." : "Estimate based on current offers."
        ) : !estimate ? "Calculating shipping, tax, and discounts…" : null}
      </p>
      {estimate && "error" in estimate && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>Cart total unavailable</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{estimate.error}</span>
            <Button type="button" size="sm" variant="outline" className="min-h-9" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
