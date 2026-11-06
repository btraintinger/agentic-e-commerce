import nextEnv from "@next/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { readDataset } from "../src/dataset";
import { seedCatalog } from "../src/server/db/seed-catalog";

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before seeding");
  const dataset = readDataset();
  const connection = postgres(process.env.DATABASE_URL);
  try {
    await seedCatalog(drizzle(connection), dataset);
    console.log(`Seeded ${dataset.products.length} products and ${dataset.categories.length} categories`);
  } finally {
    await connection.end();
  }
}

await main();
