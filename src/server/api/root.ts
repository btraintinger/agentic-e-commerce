import { postRouter } from "~/server/api/routers/post";
import { webshopProcedures } from "~/server/api/routers/webshop";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  post: postRouter,
  ...webshopProcedures,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
