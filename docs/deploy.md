# Deploying to Railway

<sub>English · [Tiếng Việt](vi/deploy.md)</sub>

The live demo runs on [Railway](https://railway.com) as three services in one project:

| Service | Source | Notes |
|---|---|---|
| **Postgres** | Railway's Postgres plugin | The only database; it also holds the pg-boss queue and uploaded covers. |
| **Readly** (web) | This repo, branch `main` | Railway builds the `Dockerfile`; has a public domain. |
| **worker** | This repo, branch `main` | Same image with `SERVICE_ROLE=worker`; no domain needed. |

## First setup

1. **Create a project** and add **Postgres** (New → Database → PostgreSQL).
2. **Create the web service** from the GitHub repo (New → GitHub Repo), branch `main`.
3. **Create the worker service** from the same repo and branch.
4. **Set variables** on both services (see [Configuration](configuration.md)):
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - the AI variables (`AI_PROVIDER`, `OPENAI_*`, …)
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and `SEED_DEMO=true` for the demo class
   - `WEB_PUSH_*` (generate fresh keys for production)
   - on the worker only: `SERVICE_ROLE=worker`
5. **Generate a domain** for web: Settings → Networking → Generate Domain, port `3000`.
6. **Deploy.** On the first run, web applies migrations and seeds; the log shows the seed summary. The worker prints `[worker] sẵn sàng` with its queues.

Later deploys still apply new migrations automatically but skip the seed (log: "Cơ sở dữ liệu đã có dữ liệu, bỏ qua seed"), so changes made by admins are never overwritten.

## Deploy on merge to `main`

Railway deploys automatically only when its GitHub app can read the repo:

1. The repo belongs to an organization, so the app must be installed for the **organization**: `https://github.com/organizations/<org>/settings/installations` → Railway → Configure → allow this repo. If it is not installed, go to Railway → Account Settings → Integrations → GitHub.
2. On each service: Settings → Source → **Connect Repo**, choose the repo and branch `main`. Turn off **Wait for CI** if you do not want to wait for GitHub Actions.

After a merge, both web and worker show a new build under Deployments within seconds.

## Data after a deploy

- The seed only runs on an empty database. Content added to the seed later (for example covers in `content/covers/`) does not appear in a database that already has data; add it through the admin pages.
- To change the AI model, edit `OPENAI_MODEL` on both web and worker; Railway restarts the services.
- A browser tab still showing the previous build during a deploy can make the log report `Failed to find Server Action`; reloading the page fixes it.

## Running the image elsewhere

```bash
docker compose --profile app up -d --build   # postgres + migrate/seed + app + worker
```

The image does not depend on Railway: any platform that runs Docker and provides Postgres works. Set `COOKIE_SECURE=false` if there is no HTTPS.
