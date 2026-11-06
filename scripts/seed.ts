import nextEnv from "@next/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { parseDataset } from "../src/dataset";
import { seedCatalog } from "../src/server/db/seed-catalog";
import { generateDataset, JKU_SEED } from "./generate-data.mjs";

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before seeding");
  const connection = postgres(process.env.DATABASE_URL);
  const db = drizzle({ client: connection });
  try {
    const dataset = parseDataset(generateDataset());
    await seedCatalog(db, dataset, { offerSeed: JKU_SEED });
    console.log(`Generated JKU catalog with Drizzle Seed: ${dataset.products.length} products and ${dataset.categories.length} categories`);
  } finally {
    await connection.end();
  }
}

await main();
