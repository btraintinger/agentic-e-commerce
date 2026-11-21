import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { relations } from "@/server/db/relations";

export function connect(url: string, max = 5) {
  const client = postgres(url, { max, prepare: false });
  return { db: drizzle({ client, relations }), close: () => client.end() };
}

export type Database = ReturnType<typeof connect>["db"];

const globalDatabase = globalThis as typeof globalThis & {
  webshopDb?: Database;
};
let database: Database | undefined;

export function getDb(): Database {
  const existing = database ?? globalDatabase.webshopDb;
  if (existing) return existing;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  database = connect(url).db;
  if (process.env.NODE_ENV === "development")
    globalDatabase.webshopDb = database;
  return database;
}
