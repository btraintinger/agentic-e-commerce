import "server-only";

import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError, flattenError } from "zod";
import { getDb } from "@/server/db";

export function createTRPCContext({ headers }: { headers: Headers }) {
  return { getDb, headers };
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const message =
      error.code === "INTERNAL_SERVER_ERROR"
        ? "Internal server error"
        : shape.message;
    return {
      ...shape,
      message,
      data: {
        ...shape.data,
        ...(error.code === "INTERNAL_SERVER_ERROR" ? { stack: undefined } : {}),
        zodError:
          error.cause instanceof ZodError ? flattenError(error.cause) : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
