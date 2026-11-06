import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { clientRateLimitKey } from "./cart-rate-limit";

export async function createTRPCContext(opts: { headers: Headers }) {
  const [{ db }, { env }] = await Promise.all([import("~/server/db"), import("~/env")]);

  return {
    ...opts,
    db,
    getSession: async () => (await import("~/server/auth")).auth(),
    rateLimitKey: clientRateLimitKey(opts.headers, env.TRUST_PROXY === "true"),
  };
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const session = await ctx.getSession();
  if (!session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });

  return next({ ctx: { session } });
});
