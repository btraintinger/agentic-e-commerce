import { createTRPCClient, httpBatchLink, httpLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import { GET, POST } from "@/app/api/trpc/[trpc]/route";
import type { AppRouter } from "@/server/api/root";
import { createQueryClient } from "@/trpc/query-client";

export function client(headers?: Record<string, string>, batch = false) {
  const link = batch ? httpBatchLink : httpLink;
  return createTRPCClient<AppRouter>({
    links: [
      link({
        url: "http://localhost/api/trpc",
        transformer: superjson,
        headers,
        fetch(url, options) {
          const request = new Request(url, options);
          return request.method === "GET" ? GET(request) : POST(request);
        },
      }),
    ],
  });
}

export function createTestTRPCOptions() {
  const api = client();
  const queryClient = createQueryClient();
  const trpc = createTRPCOptionsProxy<AppRouter>({ client: api, queryClient });
  return { trpc, queryClient };
}
