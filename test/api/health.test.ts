import { afterEach, expect, it, vi } from "vitest";
import { client } from "../support/trpc-client";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
});

it("serves the tRPC health check without needing a database connection", async () => {
  vi.stubEnv("DATABASE_URL", undefined);

  await expect(client().health.check.query()).resolves.toEqual({
    status: "ok",
  });
});
