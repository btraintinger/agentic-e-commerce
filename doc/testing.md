# Agentic webshop test plan

| Suite                 | What to test                                                 | How                                                                                                     | Libraries                                | CI                             |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------ |
| API contract          | Health, input errors and cart rate limits                    | Call the actual tRPC HTTP handler with Web Requests and no database.                                    | Vitest, tRPC, SuperJSON                  | Required on PRs                |
| Database integration  | Migrations, catalog queries, cart totals and voucher privacy | Call the API against migrated, deterministically seeded PostgreSQL.                                     | Vitest, PostgreSQL, Drizzle, Postgres.js | Required on PRs                |
| Agent orchestration   | Tool dispatch, argument validation and error handling        | Run the real agent with a scripted model and mocked tool dependencies.                                  | Vitest, AI SDK `MockLanguageModelV4`     | Required on PRs once built     |
| Real-model evaluation | Tool choice and answers grounded in fixture data             | Run fixed prompts against a pinned model at temperature 0 with fixture tools, without a UI or database. | Vitest, AI SDK                           | Optional manual or nightly run |
| React components      | Search and cart controls, loading, empty and error states    | Render interactive components in isolation with controlled state.                                       | Vitest, jsdom, Testing Library           | Required on PRs once built     |
| Browser end to end    | Search, compare offers and validate a cart                   | Run Chrome against the dev server, real API and seeded database with the pinned WebLLM model.           | Playwright                               | Manual, needs WebGPU           |

## Current suites

- `test/unit/` covers pure cart calculation and the agent scaffold.
- `test/api/` exercises the tRPC HTTP contract and rate limits without PostgreSQL.
- `test/integration/` covers catalog procedures, migration and seed behavior, and cart validation against PostgreSQL.
- `test/e2e/` replays a chat conversation in Chrome with the real model and checks the recognised request JSON, see [Browser end to end](#browser-end-to-end).
- `test/support/` contains the in-process tRPC client and temporary database fixture.

```sh
pnpm test test/unit test/api
TEST_DATABASE_URL=postgresql://webshop:webshop@127.0.0.1:5432/webshop pnpm test test/integration
```

Run `pnpm test` to select all suites. The PostgreSQL suites run when
`TEST_DATABASE_URL` is set. Use a disposable PostgreSQL instance and a role
that can create and drop test databases.

## Browser end to end

`test/e2e/` replays a chat conversation in Chrome with the real model. It needs
Google Chrome with WebGPU (`pnpm exec playwright install chrome`, check
`chrome://gpu`) and a seeded database.

```sh
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm test:prompts
```

- `pnpm test:prompts` runs the whole conversation once, prints each message,
  reply and recognised request in the terminal and ends with a pass or fail.
  Use it to check a prompt change.
- `pnpm test:prompts:ui` opens the Playwright UI. You start the test by hand,
  watch it step by step and inspect the DOM, console and network of every
  step. Use it to find out why a step fails.

`pnpm exec playwright show-report` opens the report of the last run. The suite
does not run in CI.
