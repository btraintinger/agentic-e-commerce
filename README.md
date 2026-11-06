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

The development, start, and preview scripts bind Next.js to `127.0.0.1`. The
starter is at `http://localhost:3000` and tRPC is at
`http://localhost:3000/api/trpc`. The app connects to Docker Postgres at
`127.0.0.1:5433`. The Compose volume retains the database when you stop the container.

`pnpm db:seed` builds the curated JKU catalog with fixed seed `2026`. Drizzle
Seed refinements generate each offer's stock and delivery window. The JSON
export uses the same catalog, prices, and shipping rules with the generator's
base stock and delivery values. To export it, run
`node scripts/generate-data.mjs /tmp/jku-catalog.json`.

To import a catalog JSON file as supplied, run
`DATASET_PATH=/path/to/catalog.json pnpm db:seed`.

Both modes replace the webshop catalog and vouchers in one transaction on
every run. Auth.js and starter post data stay intact.

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
operation in a tRPC batch. The limiter lives in the app process. Direct access
is for local development and shares a single bucket. To expose Next.js to
shared or network clients, put a trusted reverse proxy in front of it and
restrict network access so clients can only reach the proxy. The proxy must
overwrite `X-Forwarded-For` with a single client IP. Set `TRUST_PROXY=true`
for that deployment.

## Checks

```sh
pnpm typecheck && pnpm test
pnpm build
```

The PostgreSQL integration suite uses a dedicated, disposable database. It
checks API behavior with the fixed-seed catalog.
Create the database once and opt in by setting its URL:

```sh
docker compose exec -T postgres createdb -U webshop webshop_test
TEST_DATABASE_URL=postgresql://webshop:webshop@127.0.0.1:5433/webshop_test pnpm test
```

Use `pnpm db:generate` after editing the Drizzle schema and commit the generated
migration.

## License

This project is developed for educational purposes at the Institute of
Business Informatics — Software Engineering, Johannes Kepler University Linz.
