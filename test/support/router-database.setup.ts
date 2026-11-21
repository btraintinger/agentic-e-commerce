import { afterAll, inject, vi } from "vitest";

if (process.env.TEST_DATABASE_URL) {
  const url = inject("routerDatabaseUrl");
  if (!url)
    throw new Error("The router test database has not been initialized");

  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv("VERCEL", "0");

  afterAll(() => {
    vi.unstubAllEnvs();
  });
}
