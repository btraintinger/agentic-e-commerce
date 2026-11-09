import { createTRPCClient, httpLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "~/server/api/root";

export function createWebshopClient() {
  return createTRPCClient<AppRouter>({
    links: [httpLink({ url: "/api/trpc", transformer: superjson })],
  });
}
