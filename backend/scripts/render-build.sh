#!/usr/bin/env sh
# Render build step: compile, apply versioned migrations, optionally seed.
# Replaces the former `prisma db push && db:seed`, which could silently
# drop columns on schema changes and re-ran the seed on every deploy.
set -eu

npx prisma generate
npm run build

# The production database was created with `db push`, so it has tables but no
# migration history. Prisma reports P3005 in that case; we baseline it once by
# marking 0_init as applied (same schema), then deploy any newer migrations.
if output=$(npx prisma migrate deploy 2>&1); then
  echo "$output"
else
  echo "$output"
  if echo "$output" | grep -q "P3005"; then
    echo "==> Existing schema without migration history: baselining 0_init"
    npx prisma migrate resolve --applied 0_init
    npx prisma migrate deploy
  else
    exit 1
  fi
fi

# Seeding is opt-in per deploy (e.g. first deploy or password rotation).
if [ "${RUN_SEED_ON_DEPLOY:-false}" = "true" ]; then
  echo "==> RUN_SEED_ON_DEPLOY=true: running seed"
  npm run db:seed
fi
