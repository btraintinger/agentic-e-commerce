# Local development

Follow the [README quick start](../README.md#quick-start) to install
dependencies, start PostgreSQL, migrate and seed the database, and run Next.js.

## Local configuration

Next.js runs on the host and connects to PostgreSQL at `127.0.0.1:5432`.
The values in [`.env.example`](../.env.example) point both database variables
to the local Compose service.

| Variable              | Used by                        |
| --------------------- | ------------------------------ |
| `DATABASE_URL`        | The Next.js app                |
| `DATABASE_URL_DIRECT` | Migrations and the seed script |
| `TEST_DATABASE_URL`   | Vitest integration tests       |

The Compose volume keeps data when the database container stops. This setup
uses `webshop-pg17-data` and leaves any previous `postgres-data` volume
available separately.

## Migrations and seed data

The Drizzle schema is the source for database types. After a schema change,
use `pnpm db:generate` to generate the migration SQL and snapshot. Apply
migrations with `pnpm db:migrate`.

The deterministic seed includes the JKU catalog, 12 products tagged
`starter-set`, multiple offers per variant, Austrian package-tax examples,
and voucher scenarios. Rerun `pnpm db:seed` on the same database as needed.

## Checks and production build

Use `pnpm format` to apply Prettier or `pnpm format:check` to check formatting.

```sh
pnpm lint
pnpm typecheck
TEST_DATABASE_URL=postgresql://webshop:webshop@127.0.0.1:5432/webshop pnpm test
pnpm build
pnpm start
```

Use a disposable PostgreSQL server for the integration tests. The role in
`TEST_DATABASE_URL` needs permission to create and drop temporary test
databases. With that variable unset, Vitest runs the database-independent
tests.

[GitHub Actions](../.github/workflows/ci.yml) installs dependencies with
`pnpm ci`, checks formatting, lint, and types, migrates and seeds its own
PostgreSQL service, runs both test suites, and builds the app. It caches the
pnpm store and `.next/cache`.

- [Testing](testing/test-plan.md)
- [Git workflow](git/README.md)
