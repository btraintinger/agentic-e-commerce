import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig, authEnabled } from "./config";

const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);

const auth = cache(async () => (authEnabled ? uncachedAuth() : null));

export { auth, handlers, signIn, signOut };
