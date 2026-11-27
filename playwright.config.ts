import { defineConfig } from "@playwright/test";

/**
 * Browser prompt tests: the chat model runs on WebGPU (WebLLM), so they need
 * a real, headed Chrome. Run with `pnpm test:prompts`.
 */
export default defineConfig({
  testDir: "test/e2e",
  workers: 1,
  timeout: 10 * 60_000,
  expect: { timeout: 60_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
