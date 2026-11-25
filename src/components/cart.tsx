"use client";

import { useMutation } from "@tanstack/react-query";
import { useCart } from "@/components/cart-provider";
import { formatCents } from "@/components/format";
import { useTRPC } from "@/trpc/client";

export function Cart() {
  const trpc = useTRPC();
  const { items, remove } = useCart();
  const validate = useMutation(trpc.cart.validate.mutationOptions());
  const request = {
    items: items.map(({ offerId, quantity }) => ({ offerId, quantity })),
  };
  const result =
    JSON.stringify(validate.variables) === JSON.stringify(request)
      ? validate.data
      : undefined;
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <aside className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="font-semibold">Cart</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
      ) : (
        <ol className="flex flex-col gap-2 text-sm">
          {items.map((item, index) => (
            <li key={item.offerId} className="flex items-start gap-2">
              <span className="text-muted-foreground">{index + 1}.</span>
              <span className="flex-1">
                {item.quantity} × {item.name}
                <span className="block text-xs text-muted-foreground">
                  {item.variantName} · {formatCents(item.price)}
                </span>
              </span>
              <button
                type="button"
                className="text-xs underline"
                onClick={() => remove(item.offerId)}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="text-sm">Subtotal: {formatCents(subtotal)}</p>
      <button
        type="button"
        className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
        disabled={items.length === 0 || validate.isPending}
        onClick={() => validate.mutate(request)}
      >
        {validate.isPending ? "Checking…" : "Check total"}
      </button>
      {validate.error && (
        <p className="text-sm text-destructive">{validate.error.message}</p>
      )}
      {result && (
        <div className="text-sm">
          <p>Shipping: {formatCents(result.totals.shipping)}</p>
          <p className="font-semibold">
            Total: {formatCents(result.totals.grand)}
          </p>
          {result.issues.map((issue) => (
            <p
              key={issue.code + (issue.offerId ?? "")}
              className="text-destructive"
            >
              {issue.message}
            </p>
          ))}
        </div>
      )}
    </aside>
  );
}
