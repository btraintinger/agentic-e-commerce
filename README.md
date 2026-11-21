<div align="center">

<img src="public/icon.svg" alt="" width="128" height="128" />

<h1>Agentic E-Commerce</h1>

<p>
  <strong>A webshop you can talk to.</strong><br />
  <em>Find it. Compare it. Put it in your cart.</em>
</p>

<p>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=000" />
  <img alt="TypeScript 5.9" src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white" />
  <img alt="tRPC 11" src="https://img.shields.io/badge/tRPC-11-2596be?logo=trpc&logoColor=white" />
  <img alt="Drizzle ORM 1.0 RC" src="https://img.shields.io/badge/Drizzle_ORM-1.0_RC-c5f74f?logo=drizzle&logoColor=000" />
  <img alt="PostgreSQL 17" src="https://img.shields.io/badge/PostgreSQL-17-4169e1?logo=postgresql&logoColor=white" />
</p>

<sub>
  <a href="#stack">Stack</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#layout">Layout</a>
</sub>

<br />

<sub>
  <a href="doc/development.md">Development</a> ·
  <a href="doc/api.md">tRPC API</a> ·
  <a href="doc/testing.md">Test setup</a> .
  <a href="doc/git/README.md">Git workflow</a>
</sub>

</div>

---

“Find me a summer outfit under €100.” Agentic E-Commerce is a JKU Linz IT
Project 2026/27 that aims to make that request the start of a shopping trip.
The goal is to browse the shop, search and filter products, compare offers,
and manage a cart entirely through chat. A freely available, open-source
language model would run locally and use tool calls to act on those requests.

---

## Stack

| Layer                | Technology                                                                             |
| -------------------- | -------------------------------------------------------------------------------------- |
| Runtime              | Node.js 26 (ES modules) and pnpm 11                                                    |
| Frontend             | Next.js 16 App Router, React 19, Tailwind CSS 4, and shadcn/ui tooling                 |
| Types and validation | TypeScript 5.9 and Zod 4                                                               |
| API and client data  | tRPC 11, SuperJSON, and TanStack Query 5                                               |
| Shopping agent       | AI SDK 7 and WebLLM for planned in-browser model inference                             |
| Database             | PostgreSQL 17 (Docker Compose), Postgres.js, and Drizzle ORM 1.0 RC                    |
| Migrations and seed  | Drizzle Kit and Drizzle Seed                                                           |
| Testing              | Vitest 4, with Testing Library, jsdom, and Playwright for planned UI and browser tests |
| Code quality         | ESLint 9 and Prettier 3                                                                |

---

<a name="quick-start"></a>

## Getting started

Install Node.js 26, the pnpm version pinned in [`package.json`](package.json),
and Docker with Compose. From the repository root, run the commands below.
If `.env.local` already exists, add the settings from `.env.example` to it and
skip the copy command.

```sh
cp .env.example .env.local
pnpm install --frozen-lockfile
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [localhost:3000](http://localhost:3000).

### Environment

The Next.js app uses `DATABASE_URL`. Migrations and the seed script use
`DATABASE_URL_DIRECT`. The defaults in [`.env.example`](.env.example)
point both variables at the local Compose database. Set `TEST_DATABASE_URL`
to run integration tests against a disposable PostgreSQL instance. See the
[development guide](doc/development.md).

---

## Layout

| Path                                                        | What lives there                          |
| ----------------------------------------------------------- | ----------------------------------------- |
| [`src/app/`](src/app/)                                      | Next.js pages and the tRPC HTTP route     |
| [`src/agent/`](src/agent/)                                  | Shopping agent entry point                |
| [`src/server/api/`](src/server/api/)                        | tRPC router and procedures                |
| [`src/server/catalog/`](src/server/catalog/)                | Product filters and queries               |
| [`src/server/cart/`](src/server/cart/)                      | Cart validation and totals                |
| [`src/server/db/`](src/server/db/)                          | Database connection and schema            |
| [`drizzle/`](drizzle/) and [`scripts/seed/`](scripts/seed/) | Migrations and catalog seed               |
| [`test/`](test/)                                            | Unit, HTTP handler, and integration tests |
| [`doc/`](doc/)                                              | Development, API, testing, and Git guides |

---

Developed for educational purposes at the Institute of Business Informatics —
Software Engineering, Johannes Kepler University Linz.
