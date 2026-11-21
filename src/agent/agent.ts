import type { QueryClient } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { LanguageModel } from "ai";
import type { AppRouter } from "@/server/api/root";

export const createShoppingAgent: (
  model: LanguageModel | undefined,
  trpc: TRPCOptionsProxy<AppRouter>,
  queryClient: QueryClient,
) => void = () => {};
