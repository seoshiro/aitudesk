#!/bin/sh
set -e

echo "==> Pushing Prisma schema to database..."
npx prisma db push

echo "==> Seeding database (idempotent)..."
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

echo "==> Seed completed. Starting server..."
exec node dist/index.js
