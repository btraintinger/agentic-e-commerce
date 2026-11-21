import { expect, test, vi } from "vitest";
import { createShoppingAgent } from "@/agent/agent";
import { createTestTRPCOptions } from "../../support/trpc-client";

vi.mock("server-only", () => ({}));

test("the shopping agent scaffold leaves the query cache empty", () => {
  const { trpc, queryClient } = createTestTRPCOptions();
  const model = undefined;

  createShoppingAgent(model, trpc, queryClient);

  expect(queryClient.getQueryCache().getAll()).toEqual([]);
});
