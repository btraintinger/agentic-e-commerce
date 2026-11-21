import nextEnv from "@next/env";
import { defineConfig } from "drizzle-kit";

nextEnv.loadEnvConfig(process.cwd(), true);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_DIRECT ?? "" },
});
