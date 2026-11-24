#!/bin/sh
set -e

echo "==> Applying database migrations..."
npx prisma migrate deploy

echo "==> Seeding database (idempotent)..."
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

echo "==> Seed completed. Starting server..."
exec node dist/index.js
