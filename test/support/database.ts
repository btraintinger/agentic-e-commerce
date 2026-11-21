import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { connect } from "@/server/db";
import { seedCatalog } from "../../scripts/seed/seed";

export async function createTestDatabase(adminUrl: string) {
  const name = `webshop_test_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const admin = postgres(adminUrl, { max: 1 });
  let created = false;
  let connection: ReturnType<typeof connect> | undefined;

  async function close() {
    try {
      await connection?.close();
    } finally {
      try {
        if (created) {
          await admin`drop database ${admin(name)} with (force)`;
        }
      } finally {
        await admin.end();
      }
    }
  }

  try {
    await admin`create database ${admin(name)} template template0 locale 'C'`;
    created = true;
    connection = connect(url.href, 1);
    await migrate(connection.db, { migrationsFolder: "drizzle" });
    await seedCatalog(connection.db);
    return { db: connection.db, url: url.href, close };
  } catch (error) {
    try {
      await close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Failed to prepare and clean up the test database",
      );
    }
    throw error;
  }
}
