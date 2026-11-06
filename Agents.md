# Agents.md — Agentic E-Commerce (IT Project 2026/27)

**Rules only, no decisions:** This file contains rules only — instructions that apply to any work in this repo. Durable decisions, rationale, measurements and history do not belong here but in `docs/`/`features/` (or the project docs); open work goes to `Agents.todo.md`, settled matters to git history.

See `README.md` for project context. The tRPC contract is `AppRouter` in
`src/server/api/root.ts`. Domain types live in `src/types.ts`. The legacy REST
contract is the generated, committed `openapi.yaml`.

## Stack

- Node.js >= 22.13, pnpm, ESM (`"type": "module"`), and strict TypeScript
- Next.js App Router, tRPC, and the default Create T3 App UI
- Drizzle with PostgreSQL and a local Docker Compose service
- Auth.js with the Drizzle adapter. Webshop procedures are public.
- Zod for input and dataset validation, Vitest for tests, and tsx for scripts
- Money is always **integer cents** in `EUR`. Preserve fixture IDs as strings.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Next.js app with watch mode |
| `pnpm build` | Build the Next.js app |
| `pnpm start` | Start the built Next.js app |
| `pnpm db:generate` | Generate a Drizzle migration |
| `pnpm db:migrate` | Apply committed migrations |
| `pnpm db:seed` | Validate and import the catalog fixture |
| `pnpm typecheck` | Run `tsc --noEmit` |
| `pnpm test` | Run Vitest |
| `pnpm client` | Run the typed CLI demo against the app |
| `pnpm dev:legacy` | Start the legacy REST service with watch mode |
| `pnpm openapi` | Generate or refresh the legacy REST contract |

Use `DATABASE_URL` for Postgres. `DATASET_PATH` selects the seed or legacy
service fixture and defaults to `data/dataset.json`. Use a disposable
`TEST_DATABASE_URL` for the PostgreSQL integration suite.

## Project structure

```
src/app/                 # T3 starter UI and tRPC/Auth.js route handlers
src/server/api/          # tRPC context and routers
src/server/auth/         # Auth.js setup
src/server/db/           # Drizzle schema, catalog queries, seed transaction
src/types.ts             # domain and cart types
src/dataset.ts           # Zod fixture schema and legacy loader
src/validate.ts          # pure cart validation logic
src/server.ts            # legacy REST server factory
src/routes/              # legacy REST route plugins
drizzle/                 # committed Drizzle migrations
data/dataset.json        # generated default catalog fixture
client/demo.ts           # typed tRPC CLI demo
test/                    # Vitest suites
openapi.yaml             # committed legacy REST contract
```

## API contracts

The tRPC router exposes `health`, `categories.list`, `categories.products`,
`products.list`, `products.byId`, `vendors.list`, `vendors.byId`,
`warehouses.list`, and `cart.validate`. Only `cart.validate` is a mutation.
Apply the cart validation rate limit per operation, including inside batches.
Preserve the existing catalog and cart response shapes.

Preserve these legacy REST routes and response shapes.

- `GET /health` → `{ status: "ok" }`
- `GET /categories` → `Category[]`
- `GET /categories/:id/products` → `Product[]` (404 if category unknown)
- `GET /products?category=&q=&minPrice=&maxPrice=` → `Product[]`
  (`q` matches name/description/brand/tags, case-insensitive; price filters in
  cents, match if **any** offer price is in range)
- `GET /products/:id` → `Product` (404 if unknown)
- `GET /vendors` → `Vendor[]`, `GET /vendors/:id` → `Vendor` (404)
- `GET /warehouses` → `Warehouse[]` (warehouse UUIDs are public)
- `POST /validate` → `ValidateResponse` (rate-limited 5/min/IP → 429)
- All error bodies: `{ statusCode, error, message }` (fastify default shape).

Vouchers are **never exposed via the API** (no list/detail endpoint); the only way
to test a code is cart validation. Type shapes are defined in `src/types.ts`.

## Cart validation semantics

- Request: `{ items: { offerId: string; quantity: number }[]; voucherCode?: string }`.
- Response: `{ valid, issues, shipments, totals, deliveryDays, packageCount }`
  (see `src/types.ts`).
- Unknown offer → `OFFER_NOT_FOUND`; `quantity < 1` or non-integer → `INVALID_QUANTITY`;
  `quantity > stock` → `OUT_OF_STOCK`. Problem items are excluded from shipments/totals.
- Shipments group valid items by `(vendorId, warehouseId)`.
- Shipment `shippingCost = Σ item.shippingCost × quantity`; set to `0` if any item's
  offer has `freeShippingThreshold` and the shipment's `itemsSubtotal >=` that threshold.
- Shipment `deliveryDays = { min: max(items.min), max: max(items.max) }` (ships complete).
- Overall `deliveryDays = { min: max(shipments.min), max: max(shipments.max) }`,
  `null` when there are no shipments.
- Voucher: applied to items subtotal (never shipping); with `categoryId` only to the
  matching items' subtotal. Discount capped at eligible subtotal. Invalid voucher →
  `discount: 0` + issue (items/shipping still computed).
- `grand = items + shipping − discount`.

## Shipping & taxes

- Offers carry per-item `shippingCost` in cents; most offers have `shippingCost: 0`.
- `freeShippingThreshold` is only set on paid offers; when a shipment's `itemsSubtotal >=`
  threshold, that shipment's `shippingCost` is reduced to 0.
- Austrian warehouses (country `"AT"`) carry a flat `packageTax` of 300 cents per shipment.
- `Shipment` exposes both `shippingCost` and `packageTax`.
- `totals.shipping` = sum over all shipments of (`shippingCost` + `packageTax`).

## Dataset

- The dataset is generated by `scripts/generate-data.mjs` — never hand-edit `data/dataset.json`.
- Regenerate with `node scripts/generate-data.mjs`.
- Curated "JKU Starter Set" products are tagged `starter-set`.

## Build & verify

- Follow skill `build-verify` (agents-skills); its always-on kernel is
  `.agents/rules/build-verify.md`: pull before changing, delegate implementation,
  verify in an independent subagent, commit after every round, push and watch CI.
  Do not keep a local copy of that flow.
- Implementation and verification go to **separate, independent subagents** — never
  validate your own work. The verifying subagent reports findings with `file:line` +
  severity; it does not fix them.

## Conventions

- **Conventional Commits** (`feat:`, `fix:`, `test:`, `docs:`, `chore:`)
- No comments in code unless necessary; strict TS, no `any`
- Keep `src/validate.ts` pure (data in → result out) so it is unit-testable
- Test tRPC with its caller or Fetch adapter. Test legacy REST with Fastify
  injection. HTTP API tests do not bind a live port.
- After changes always run: `pnpm typecheck && pnpm test`
- When the legacy REST API shape changes, regenerate `openapi.yaml` with
  `pnpm openapi` and commit it. Commit generated Drizzle migrations with schema changes.
