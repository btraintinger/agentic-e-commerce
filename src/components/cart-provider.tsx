"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CartControls, CartLine } from "@/agent/agent";

interface CartContextValue extends CartControls {
  items: CartLine[];
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const latest = useRef(items);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      lines: () => latest.current,
      add: (line) => {
        const exists = latest.current.some(
          (item) => item.offerId === line.offerId,
        );
        latest.current = exists
          ? latest.current.map((item) =>
              item.offerId === line.offerId
                ? { ...item, quantity: item.quantity + line.quantity }
                : item,
            )
          : [...latest.current, line];
        setItems(latest.current);
      },
      remove: (offerId) => {
        latest.current = latest.current.filter(
          (item) => item.offerId !== offerId,
        );
        setItems(latest.current);
      },
    }),
    [items],
  );

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart must be used inside CartProvider");
  return cart;
}
