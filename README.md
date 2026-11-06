# Agentic E-Commerce — IT Project 2026/27

A read-only webshop catalog for a JKU Linz student exercise. An AI assistant can
find products and validate a shopping cart through tRPC. Cart validation computes
shipments, delivery estimates, shipping charges, and voucher discounts. The
client holds the cart. The homepage is the default Create T3 App starter.

## Local development

Install Node.js 22.13 or later, pnpm, and Docker Compose. From a fresh checkout:

```sh
pnpm install
cp .env.example .env
docker compose up -d --wait postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Next.js serves the starter at `http://localhost:3000` and tRPC at
`http://localhost:3000/api/trpc`. The app runs on the host and connects to Docker
Postgres at `127.0.0.1:5433`. The Compose volume retains the database when you
stop the container.

`pnpm db:seed` replaces the catalog and vouchers from `data/dataset.json` in one
transaction. Rerun it after changing fixtures. Select another fixture with
`DATASET_PATH=./my-fixture.json pnpm db:seed`. The seed leaves Auth.js and starter
post tables alone. Regenerate the default fixture with
`node scripts/generate-data.mjs`.

Auth.js includes the Drizzle adapter and the starter's Discord provider. The
webshop procedures are public and work with the Auth.js values in `.env.example`
left blank. When enabling Discord sign-in, set `AUTH_SECRET`, `AUTH_DISCORD_ID`,
and `AUTH_DISCORD_SECRET` and configure the callback
`http://localhost:3000/api/auth/callback/discord` with Discord.

## Webshop procedures

| Procedure | Operation | Result |
| --- | --- | --- |
| `health` | Query | Service liveness |
| `categories.list` | Query | All categories |
| `categories.products` | Query | Products for the supplied category ID |
| `products.list` | Query | Products filtered by optional category, text, and price bounds |
| `products.byId` | Query | Product with its variants and offers |
| `vendors.list` | Query | All vendors |
| `vendors.byId` | Query | Vendor detail |
| `warehouses.list` | Query | All warehouses |
| `cart.validate` | Mutation | Cart issues, shipments, totals, delivery days, and package count |

The server exports `AppRouter` from `src/server/api/root.ts` for typed clients.
Run `pnpm client` with the app running for a walkthrough. Set `BASE_URL` to target
another app URL.

Money is expressed in integer euro cents. Product text search is case-insensitive
and matches name, description, brand, and tags. Both price bounds must match the
same offer. Cart validation takes `{ items: { offerId, quantity }[], voucherCode? }`
and returns per-item issues for unknown offers, invalid quantities, and
insufficient stock. It applies voucher discounts to eligible items and adds the
Austrian package tax to the shipping total. Voucher records stay on the server.

Cart validation allows five attempts per minute per client IP, counting each
operation in a tRPC batch. The limiter lives in the app process. In the default
direct local setup, requests share one bucket. To distinguish IPs behind a
trusted reverse proxy, have that proxy overwrite `X-Forwarded-For` with a single
client IP, restrict direct access to the app, and set `TRUST_PROXY=true`.

## Legacy REST compatibility

Existing REST clients can use the transitional Fastify service and the committed
`openapi.yaml` contract. Run `PORT=3001 pnpm dev:legacy` alongside Next.js, or run
`pnpm dev:legacy` on its original port 3000 when Next.js is stopped. Swagger UI is
available at `/docs`. The legacy service reads the JSON fixture at startup and
supports `DATASET_PATH`.

## Checks

```sh
pnpm typecheck && pnpm test
pnpm build
```

The PostgreSQL integration suite uses a dedicated, disposable database. Create
it once and opt in by setting its URL:

```sh
docker compose exec -T postgres createdb -U webshop webshop_test
TEST_DATABASE_URL=postgresql://webshop:webshop@127.0.0.1:5433/webshop_test pnpm test
```

Use `pnpm db:generate` after editing the Drizzle schema and commit the generated
migration. Run `pnpm openapi` after changes to the legacy REST contract.

## License

This project is developed for educational purposes at the Institute of
Business Informatics — Software Engineering, Johannes Kepler University Linz.
