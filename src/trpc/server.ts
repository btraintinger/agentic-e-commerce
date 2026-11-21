import "server-only";

import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { cache } from "react";

import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { createQueryClient } from "./query-client";

export const getQueryClient = cache(createQueryClient);

const getContext = cache(async () => {
  const requestHeaders = new Headers(await headers());
  requestHeaders.set("x-trpc-source", "rsc");
  return createTRPCContext({ headers: requestHeaders });
});

export const trpc = createTRPCOptionsProxy({
  router: appRouter,
  ctx: getContext,
  queryClient: getQueryClient,
});
