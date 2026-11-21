"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
} from "@trpc/client";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState, type ReactNode } from "react";
import superjson from "superjson";

import type { AppRouter } from "@/server/api/root";
import { createQueryClient } from "./query-client";

const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();
export { useTRPC, useTRPCClient };

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return createQueryClient();
  return (browserQueryClient ??= createQueryClient());
}

function getTRPCUrl() {
  if (typeof window !== "undefined") return "/api/trpc";
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/trpc`;
  }
  return `http://localhost:${process.env.PORT ?? 3000}/api/trpc`;
}

export function TRPCReactProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
          logger: ({ direction, path, type }) => {
            console.debug(`[tRPC] ${direction} ${type} ${path}`);
          },
        }),
        httpBatchStreamLink({
          url: getTRPCUrl(),
          transformer: superjson,
          headers: () => ({ "x-trpc-source": "nextjs-react" }),
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
