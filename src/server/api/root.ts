import { cartRouter } from "@/server/api/routers/cart";
import { categoriesRouter } from "@/server/api/routers/categories";
import { healthRouter } from "@/server/api/routers/health";
import { productsRouter } from "@/server/api/routers/products";
import { vendorsRouter } from "@/server/api/routers/vendors";
import { warehousesRouter } from "@/server/api/routers/warehouses";
import { createTRPCRouter } from "@/server/api/trpc";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  categories: categoriesRouter,
  products: productsRouter,
  vendors: vendorsRouter,
  warehouses: warehousesRouter,
  cart: cartRouter,
});

export type AppRouter = typeof appRouter;
