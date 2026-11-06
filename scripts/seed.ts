import nextEnv from "@next/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { parseDataset, readDataset } from "../src/dataset";
import { seedCatalog } from "../src/server/db/seed-catalog";
import { generateDataset } from "./generate-data.mjs";

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before seeding");
  const connection = postgres(process.env.DATABASE_URL);
  const db = drizzle(connection);
  try {
    const fixturePath = process.env.DATASET_PATH;
    const dataset = fixturePath ? readDataset(fixturePath) : parseDataset(generateDataset());
    await seedCatalog(db, dataset);
    const action = fixturePath ? "Imported from fixture" : "Generated from the fixed JKU seed";
    console.log(`${action}: ${dataset.products.length} products and ${dataset.categories.length} categories`);
  } finally {
    await connection.end();
  }
}

await main();
