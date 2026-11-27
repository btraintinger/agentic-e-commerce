import { configDefaults, defineConfig } from "vitest/config";

const routerIntegrationTests =
  "test/integration/{cart,categories,products,vendors,warehouses}.test.ts";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "default",
          exclude: [
            ...configDefaults.exclude,
            routerIntegrationTests,
            "test/e2e/**",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "router-integration",
          include: [routerIntegrationTests],
          globalSetup: "./test/support/router-database.global.ts",
          setupFiles: "./test/support/router-database.setup.ts",
        },
      },
    ],
  },
});
