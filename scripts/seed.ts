import nextEnv from "@next/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { readDataset } from "../src/dataset";
import { seedCatalog } from "../src/server/db/seed-catalog";
import { seedSampleCatalog } from "../src/server/db/seed-sample-catalog";

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before seeding");
  const connection = postgres(process.env.DATABASE_URL);
  const db = drizzle(connection);
  try {
    if (process.env.DATASET_PATH) {
      const dataset = readDataset(process.env.DATASET_PATH);
      await seedCatalog(db, dataset);
      console.log(`Imported ${dataset.products.length} products and ${dataset.categories.length} categories from the fixture`);
    } else {
      const { products, categories } = await seedSampleCatalog(db);
      console.log(`Generated ${products} products and ${categories} categories with Drizzle Seed`);
    }
  } finally {
    await connection.end();
  }
}

await main();
