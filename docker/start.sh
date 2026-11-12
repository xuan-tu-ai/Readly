#!/bin/sh
# Container entrypoint for every Readly process (one image, see Dockerfile).
#   SERVICE_ROLE=web (default): apply migrations, seed an empty database once, serve Next.js.
#   SERVICE_ROLE=worker:        run the pg-boss worker (AI grading, reminders, web push).
set -e

if [ "${SERVICE_ROLE:-web}" = "worker" ]; then
  exec npm run worker
fi

npx prisma migrate deploy
# Seeds only when there is no user yet, so redeploys never overwrite what admins edited.
SEED_ONLY_IF_EMPTY=true npx tsx prisma/seed.ts
exec npm run start
