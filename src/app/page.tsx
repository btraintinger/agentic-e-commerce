import { Cart } from "@/components/cart";
import { CartProvider } from "@/components/cart-provider";
import { Chat } from "@/components/chat";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">JKU Webshop</h1>
      <CartProvider>
        <div className="grid gap-4 md:grid-cols-[1fr_320px]">
          <Chat />
          <Cart />
        </div>
      </CartProvider>
    </main>
  );
}
