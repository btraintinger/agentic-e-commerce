"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createShoppingAgent } from "@/agent/agent";
import { useTRPC } from "@/trpc/client";

export default function HomePage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const model = undefined;
  createShoppingAgent(model, trpc, queryClient);

  return (
    <main>
      <h1>JKU Webshop</h1>
      <p>Catalog and cart validation are available through the tRPC API.</p>
    </main>
  );
}
