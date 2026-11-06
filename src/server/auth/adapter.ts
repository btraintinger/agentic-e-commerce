import { PostgresDrizzleAdapter } from "@auth/drizzle-adapter/pg";

import type { db } from "~/server/db";
import { accounts, sessions, users, verificationTokens } from "~/server/db/schema";

export function createAuthAdapter(database: typeof db) {
  return PostgresDrizzleAdapter(database, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  });
}
