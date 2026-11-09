import { ShoppingCart, X } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
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

export function ShoppingCartDrawer({
  items,
  onRemove,
}: {
  items: CartItem[];
  onRemove: (id: string) => void;
}) {
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const countLabel = count === 1 ? "1 item" : `${count} items`;

  return (
    <Sheet>
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6">
          {items.length === 0 ? (
            <div className="flex flex-col gap-1 py-6">
              <p className="font-medium">Your cart is empty.</p>
              <p className="text-sm text-muted-foreground">Select Add to cart on an offer to put it here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-sm font-semibold wrap-anywhere">{item.productName}</h3>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{price(item.price * item.quantity)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground wrap-anywhere">{item.variant} · {item.vendor}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground tabular-nums">
                      Qty {item.quantity} · {price(item.price)} each
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
                </li>
              ))}
            </ul>
          )}
        </div>
        {items.length > 0 && (
          <SheetFooter className="shrink-0 gap-1 border-t border-border px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            <dl className="flex items-center justify-between gap-4 font-semibold">
              <dt>Items subtotal</dt>
              <dd className="tabular-nums">{price(subtotal)}</dd>
            </dl>
            <p className="text-sm text-muted-foreground">Before shipping and package tax.</p>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
