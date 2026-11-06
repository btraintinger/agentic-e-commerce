import { type DefaultSession, type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

import { env } from "~/env";
import { db } from "~/server/db";
import { createAuthAdapter } from "./adapter";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const authEnabled = Boolean(
  env.AUTH_SECRET && env.AUTH_DISCORD_ID && env.AUTH_DISCORD_SECRET,
);

export const authConfig = {
  providers: authEnabled ? [DiscordProvider] : [],
  adapter: createAuthAdapter(db),
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
} satisfies NextAuthConfig;
