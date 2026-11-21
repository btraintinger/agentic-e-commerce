# AGENTS.md — Webshop Backend (IT Project 2026/27)

**Rules only, no decisions.** Durable decisions, rationale, measurements, and
history belong in the project documentation. Use `AGENTS.todo.md` for open work
and Git history for settled matters.

Start with the [README](README.md) for project context and quick start, the
[development guide](doc/development.md) for setup, the [API reference](doc/api.md)
for procedures, and the [test plan](doc/testing.md) for coverage. See
[AGENTS.todo.md](AGENTS.todo.md) for open work.

<!-- CODEGRAPH_START -->

## Code navigation

When `.codegraph/` exists at the repository root, use CodeGraph first to find
or understand code. Query `codegraph_explore` with a path, symbol, or question,
or run `codegraph explore "<path, symbol, or question>"` in the shell. Skip
CodeGraph when the index is absent.

<!-- CODEGRAPH_END -->

## Project structure

| Path                                         | What lives there                                |
| -------------------------------------------- | ----------------------------------------------- |
| [`src/app/`](src/app/)                       | Next.js routes, including the tRPC HTTP handler |
| [`src/server/api/`](src/server/api/)         | tRPC router and procedures                      |
| [`src/server/catalog/`](src/server/catalog/) | Catalog queries                                 |
| [`src/server/cart/`](src/server/cart/)       | Cart calculations                               |
| [`src/server/db/`](src/server/db/)           | Database schema and connections                 |
| [`scripts/seed/`](scripts/seed/)             | Seed definitions                                |
| [`drizzle/`](drizzle/)                       | Generated migrations                            |

## Development and database

- Use Node.js 26, the pnpm version pinned in `package.json`, and TypeScript
  with ESM. Use Next.js App Router, tRPC, Drizzle v1 with PostgreSQL, and Vitest.
- Start the app with `pnpm dev` and local PostgreSQL with
  `docker compose up -d --wait`. Use `DATABASE_URL` for the app and
  `DATABASE_URL_DIRECT` for migrations and seed.
- Generate migrations with `pnpm db:generate` and apply them with
  `pnpm db:migrate`. Include the generated SQL and snapshots with schema changes.
- Seed with `pnpm db:seed`. Keep TypeScript seed definitions deterministic.

## API contract

- Serve public procedures at `/api/trpc` and keep the documented procedure
  names stable. The exported tRPC `AppRouter` is the public API contract.
  Use Zod for tRPC inputs and Drizzle schema inference for persisted types.
- Use UUIDs for catalog IDs and integer euro cents for money. Product responses
  contain variants and offers. Match search terms against name, description,
  brand, or tags case-insensitively. Match a price range when one offer
  satisfies both bounds.
- Use tRPC `NOT_FOUND` for unknown category, product, and vendor IDs in scoped
  and detail lookups. Keep voucher records private. Check a supplied code only
  in `cart.validate`.
- Rate-limit `cart.validate` to five calls per minute per IP in each app
  instance. Return tRPC `TOO_MANY_REQUESTS` when the limit is exceeded.

## Implementation and verification

- Assign implementation and verification to **separate, independent
  subagents**. The verifier reviews the diff, runs the checks, and reports
  each finding with severity and `file:line` without editing files. The
  implementation subagent addresses findings and hands fixes back for review.
- Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build`. `pnpm check` runs the first three. Use `pnpm start` to verify
  the production build.
- Set `TEST_DATABASE_URL` to a disposable PostgreSQL instance with a role
  that can create test databases to run the integration tests.

## Conventions

- Follow the [Git guide](doc/git/README.md) for branches, pull requests,
  commits, and time tracking.
- Keep TypeScript strict, avoid `any`, and add comments only when necessary.
- Test the HTTP handler directly with Web Requests. Use fixed inputs and
  a fixed clock for cart calculation tests.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
