import nextEnv from "@next/env";
import { connect } from "@/server/db";
import { seedCatalog } from "./seed/seed";

nextEnv.loadEnvConfig(process.cwd(), true);

const url = process.env.DATABASE_URL_DIRECT;
if (!url)
  throw new Error("DATABASE_URL_DIRECT is required to seed the catalog");

const connection = connect(url, 1);
try {
  const counts = await seedCatalog(connection.db);
  console.log("Seeded catalog", counts);
} finally {
  await connection.close();
}
