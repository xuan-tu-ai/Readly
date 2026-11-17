# Development

<sub>English · [Tiếng Việt](vi/development.md)</sub>

## Requirements

- Node.js 24
- Docker Desktop (for PostgreSQL)

## Running locally

```bash
cp .env.example .env
docker compose up -d postgres     # Postgres on port 5433 (databases readly + readly_test)
npm install
npm run db:migrate                # apply migrations to the dev database
npm run db:seed                   # admin + content + (SEED_DEMO=true) demo class
npm run dev                       # http://localhost:3000
npm run worker                    # (another terminal) background job process
```

`AI_PROVIDER=mock` is the default: every AI feature works without network access or an API key. To use a real model, see [Configuration](configuration.md#ai).

Run everything (Postgres, migrate/seed, web, worker) with Docker:

```bash
docker compose --profile app up -d --build
```

## Checks

```bash
npm run lint
npm run typecheck
npm test          # unit + integration (uses the readly_test database; Postgres must be running)
npm run build
```

CI (`.github/workflows/ci.yml`) runs exactly these four commands on every pull request and every push to `main`, with Postgres and `AI_PROVIDER=mock`.

Integration tests run against a real database; each test starts from an empty database and test files run one at a time. On a machine with little RAM, run them in groups, for example `npx vitest run tests/unit`.

## Trying AI with a real model

`npm run ai:smoke` calls the configured model for every AI task (grading short and open answers, comparing predictions, drafting question sets, rubrics and mini games) on a fixed sample set, then checks the results: valid schema, complete rubrics, and multiple-choice questions whose correct option does not stand out by length. The report records the time and retries of each task, so models can be compared.

```bash
npm run ai:smoke -- --model=deepseek-v4.1-flash-1017-fast --out=report.json
npm run ai:smoke -- --only=grade,draft --repeat=3
```

It spends API calls, so it does not run in CI.

## Content

- **Works with full text:** one file per work, `content/works/<slug>.json` (metadata, background card, HTML segments, three-stage questions with rubrics, mini games). The seed validates each file with zod and only adds what is missing, so re-running it never creates duplicates.
- **Covers:** `content/covers/<slug>.webp`, 600×900. The seed attaches them to works that have no cover yet.
- **Placeholder works:** `content/works.sample.json`.
- On a running instance, admins edit content directly: import text from `.docx`, draft questions with AI and review them, upload covers.

## Conventions

- Every write is a server action in `src/app/actions`: check the session and role, validate input with zod, call a service, then `refresh()`.
- Business logic lives in `src/server/services` and has matching integration tests in `tests/integration`.
- The repo uses Next.js 16, which differs a lot from earlier versions; its bundled docs are in `node_modules/next/dist/docs/`.
