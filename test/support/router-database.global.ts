import type { TestProject } from "vitest/node";
import { createTestDatabase } from "./database";

declare module "vitest" {
  export interface ProvidedContext {
    routerDatabaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const adminUrl = process.env.TEST_DATABASE_URL;
  if (!adminUrl) return;

  const database = await createTestDatabase(adminUrl);
  project.provide("routerDatabaseUrl", database.url);
  return database.close;
}
