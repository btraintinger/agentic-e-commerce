import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import drizzle from "eslint-plugin-drizzle";
import tseslint from "typescript-eslint";

const drizzleObjectName = ["db", "getDb", "transaction"];

const config = defineConfig([
  ...nextVitals,
  {
    files: ["{src,scripts,test}/**/*.{ts,tsx}", "*.ts"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "warn",
    },
  },
  ...nextTypeScript,
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
    plugins: { drizzle },
    rules: {
      "drizzle/enforce-delete-with-where": ["error", { drizzleObjectName }],
      "drizzle/enforce-update-with-where": ["error", { drizzleObjectName }],
    },
  },
  prettier,
]);
export default config;
