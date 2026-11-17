# Configuration

<sub>English · [Tiếng Việt](vi/configuration.md)</sub>

Locally, settings come from `.env` (copy `.env.example`). On Railway, set them on **both web and worker** unless noted otherwise.

## Database

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | The app's Postgres. On Railway: `${{Postgres.DATABASE_URL}}`. |
| `TEST_DATABASE_URL` | Postgres for integration tests (only on dev machines and in CI). |

## AI

| Variable | Meaning |
|---|---|
| `AI_PROVIDER` | `mock` (default, offline), `openai` (any OpenAI-compatible server) or `gemini`. |
| `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL` | Used when `AI_PROVIDER=openai`. Example for Token Harbor: `https://tokenharbor.ai/v1`, model `deepseek-v4.1-flash-1017-fast`. |
| `OPENAI_JSON_MODE` | Optional: `json_object` for servers without structured outputs. |
| `OPENAI_TIMEOUT_MS` | Timeout per call, default `120000`. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Used when `AI_PROVIDER=gemini`. |

Switching models only means changing `OPENAI_MODEL` and restarting web and worker. Before switching, run `npm run ai:smoke -- --model=<model>` to try every AI task with the new model (see [Development](development.md#trying-ai-with-a-real-model)).

## Seed

| Variable | Meaning |
|---|---|
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | The admin account the seed creates. Required for a deploy. |
| `SEED_DEMO` | `true` to seed a teacher, the `DEMO12` demo class and 20 sample students. |
| `SEED_ONLY_IF_EMPTY` | Set by `docker/start.sh`: skip the seed when the database already has users. |

## Push notifications

| Variable | Meaning |
|---|---|
| `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` | VAPID keys. Generate a new pair with `npx web-push generate-vapid-keys`. Leave empty to keep only the in-app notification bell. |
| `WEB_PUSH_SUBJECT` | A `mailto:` or URL contact sent with notifications. |

## Other

| Variable | Meaning |
|---|---|
| `SERVICE_ROLE` | In the container: `web` (default) or `worker`. Set `worker` only on the worker service. |
| `COOKIE_SECURE` | Set to `false` when running production over plain HTTP (no HTTPS). |
| `APP_PORT`, `POSTGRES_PORT` | Ports for Docker Compose (defaults `3000`, `5433`). |
