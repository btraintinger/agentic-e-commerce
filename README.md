# Agentic E-Commerce — IT Project 2026/27

A read-only webshop catalog for a JKU Linz student exercise. An AI assistant can
find products and validate a shopping cart through tRPC. Cart validation computes
shipments, delivery estimates, shipping charges, and voucher discounts. The
client holds the cart. The homepage opens the shopping assistant.

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
shopping assistant is at `http://localhost:3000` and tRPC is at
`http://localhost:3000/api/trpc`. The app connects to Docker Postgres at
`127.0.0.1:5433`. The Compose volume retains the database when you stop the container.

For an existing database initialized with Drizzle 0.x, run `pnpm db:migrate`
after installing the Drizzle v1 dependencies. Drizzle Kit updates its migration
history in place and preserves the existing data.

`pnpm db:seed` builds the curated JKU catalog with fixed seed `2026`. Drizzle
Seed refinements generate each offer's stock and delivery window. The JSON
export uses the same catalog, prices, and shipping rules with the generator's
base stock and delivery values. To export it, run
`node scripts/generate-data.mjs /tmp/jku-catalog.json`.

Seeding replaces the webshop catalog and vouchers in one transaction on every
run. Auth.js and starter post data stay intact.

Auth.js includes the Drizzle adapter and the starter's Discord provider. The
webshop procedures are public and work with the Auth.js values in `.env.example`
left blank. When enabling Discord sign-in, set `AUTH_SECRET`, `AUTH_DISCORD_ID`,
and `AUTH_DISCORD_SECRET` and configure the callback
`http://localhost:3000/api/auth/callback/discord` with Discord.

The pinned Auth.js Drizzle adapter has a pnpm patch that exposes its PostgreSQL
implementation with Drizzle v1 types. Remove the patch when upgrading to an
adapter release that supports Drizzle v1.

## Browser shopping assistant

Open [the shopping assistant](http://localhost:3000) in a browser with
WebGPU enabled. Use localhost during development or HTTPS when hosting the app.
The first run downloads a quantized Qwen3 1.7B model and caches it in the
browser. The Vercel AI SDK runs the agent on your device using
`@browser-ai/web-llm`, with no AI API key. Product and offer results appear
as selectable cards, and the assistant can ask questions with quick replies.
When it uses a webshop tool, that tool's arguments go to the app's tRPC API
to look up live catalog data or check a cart.

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

## Live WebLLM evaluation

The 28 English scenarios in `test/live/` exercise the production shopping
transport in headless Google Chrome with WebGPU, against the fixed-seed local
tRPC server. Install Google Chrome on a machine with a working WebGPU adapter
and complete the database setup above. Start the app on a fixed origin so
Chrome can reuse the model cache:

```sh
pnpm dev --port 3005
```

In another terminal, populate a dedicated Chrome profile and run one scenario:

```sh
pnpm eval:shopping --download-model --filter thinkpad-1
```

The initial run downloads the WebLLM weights and runtime from the model
distributors and can take several minutes. Model inference runs inside the
browser. Later runs use the cached weights and block external page requests:

```sh
pnpm eval:shopping
```

Use `--filter TEXT` to select scenario IDs by substring, `--profile DIR` to
reuse a dedicated profile cached on `http://127.0.0.1:3005`, and `--report FILE`
to choose a report path. The defaults are `.webllm-eval/chrome` and
`.webllm-eval/results.json`. Reports contain the prompts, observed tRPC calls,
model output, and assertion results. Each run replaces its report and exits
with status 1 if a scenario fails or the run cannot finish. These checks use
the real model, which can vary across runs and miss expected tool calls.

## License

This project is developed for educational purposes at the Institute of
Business Informatics — Software Engineering, Johannes Kepler University Linz.
