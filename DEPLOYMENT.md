# AituDesk Free Deployment Guide

This guide deploys AituDesk without Supabase.

Recommended free stack:

- Frontend: Vercel
- Backend: Render Free Web Service
- Database: Neon Free PostgreSQL

Do not deploy pgAdmin, Prometheus, or Grafana to free hosting. They stay local/dev-only in Docker Compose.

## Current Production Shape

```
Browser
  -> Vercel static React app
  -> Render Express API + Socket.IO
  -> Neon PostgreSQL
```

Uploads are still stored on the backend filesystem. On Render Free this filesystem is ephemeral, so uploaded files are not guaranteed to survive redeploys/restarts. For a diploma demo this is acceptable if documented. For durable production uploads, add an external storage provider such as Cloudinary Free. Do not use Supabase Storage.

## Files Prepared For Deployment

- `backend/.env.example` - safe backend env template.
- `frontend/.env.example` - safe frontend env template.
- `frontend/vercel.json` - SPA fallback for React Router deep links.
- `render.yaml` - optional Render Blueprint for the backend.
- `backend/package.json` - `render:build`, `db:push`, `deploy:start` scripts.
- `backend/src/lib/env.ts` - centralized CORS/JWT/cookie environment helpers.

## 1. Create Neon PostgreSQL

1. Go to https://neon.com and create a free account.
2. Create a project named `aitudesk`.
3. Copy the PostgreSQL connection string.
4. Use a URL with SSL enabled, for example:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require
```

A pooled Neon URL is usually fine for runtime. If you later introduce Prisma migrations that require a separate direct connection, add `DIRECT_URL` and update Prisma schema intentionally. The current project uses `prisma db push`, so `DATABASE_URL` is enough.

## 2. Deploy Backend To Render

Recommended manual setup:

1. Go to https://render.com.
2. New -> Web Service.
3. Connect GitHub repo `seoshiro/aitudesk`.
4. Configure:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm install && npm run render:build` |
| Start Command | `npm run start` |
| Health Check Path | `/api/health` |
| Plan | Free |

`render:build` runs:

```bash
prisma generate
npm run build
prisma db push
npm run db:seed
```

The seed is idempotent: it upserts base users/SLA/KB content and does not delete existing user tickets, messages, ratings, or KB articles.

### Backend Environment Variables

Set these in Render:

```env
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require

JWT_ACCESS_SECRET=<generate-a-long-random-secret>
JWT_REFRESH_SECRET=<generate-a-different-long-random-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Fill after Vercel deployment, then redeploy backend.
FRONTEND_URL=https://your-frontend.vercel.app
CORS_ORIGIN=https://your-frontend.vercel.app
EXTRA_CORS_ORIGINS=

UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=10
MAX_FILES_PER_TICKET=5

SEED_ADMIN_PASSWORD=Admin123!
SEED_AGENT_PASSWORD=Agent123!
SEED_USER_PASSWORD=User123!

# Optional. If empty, /api/ai/chat returns a controlled configuration error.
AI_API_KEY=
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.3-70b-versatile
```

Render sets `PORT` automatically. Do not hardcode it.

Optional OpenRouter config:

```env
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openrouter/auto
```

## 3. Deploy Frontend To Vercel

1. Go to https://vercel.com.
2. New Project -> import the same GitHub repo.
3. Configure:

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

### Frontend Environment Variables

Set these in Vercel:

```env
VITE_API_URL=https://your-backend.onrender.com/api
VITE_SOCKET_URL=https://your-backend.onrender.com
```

`frontend/vercel.json` rewrites every path to `/index.html`, so React Router pages work after refresh.

## 4. Wire Frontend And Backend

After Vercel gives you the frontend URL:

1. Copy the Vercel production URL.
2. In Render backend env, set:

```env
FRONTEND_URL=https://your-frontend.vercel.app
CORS_ORIGIN=https://your-frontend.vercel.app
```

3. Redeploy the Render backend.
4. In Vercel frontend env, verify:

```env
VITE_API_URL=https://your-backend.onrender.com/api
VITE_SOCKET_URL=https://your-backend.onrender.com
```

5. Redeploy the Vercel frontend if you changed env values.

## 5. Smoke Tests

Backend:

```bash
curl https://your-backend.onrender.com/api/health
```

Expected:

```json
{"status":"ok","timestamp":"..."}
```

Frontend:

1. Open `https://your-frontend.vercel.app`.
2. Login as:
   - `admin@aitudesk.kz` / `Admin123!`
   - `agent1@aitudesk.kz` / `Agent123!`
   - `user1@aitudesk.kz` / `User123!`
3. Check:
   - Dashboard loads.
   - Ticket list loads.
   - Create ticket works.
   - Ticket detail opens.
   - Socket.IO chat connects without CORS errors.
   - KB list/article changes language RU / EN / KK.
   - Monthly PDF report downloads for AGENT/ADMIN.
   - AI chat returns an answer if `AI_API_KEY` is set.
   - AI chat returns a controlled error if `AI_API_KEY` is empty.

## Free Tier Limitations

- Render Free Web Services can sleep after inactivity. The first request after sleep may be slow.
- Render Free filesystem is ephemeral. Local uploads may disappear after redeploy/restart/sleep.
- Neon Free has compute/storage/project limits. It is fine for demo and coursework, but monitor usage.
- Vercel environment variables are build-time for Vite. If `VITE_API_URL` changes, redeploy frontend.
- pgAdmin, Prometheus, and Grafana are not deployed publicly in this free setup.

## Local Docker Compose

Local Docker remains supported:

```bash
docker compose up -d --build
```

Local URLs:

- Frontend: http://localhost:7754
- Backend health: http://localhost:4829/api/health
- pgAdmin: http://localhost:5050
- Prometheus: http://localhost:8800
- Grafana: http://localhost:9911

## Useful Commands

Backend local validation:

```bash
cd backend
npm install
npx prisma generate
npm run build
npx vitest run
```

Frontend local validation:

```bash
cd frontend
npm install
npm run i18n:check
npm run build
```

Manual first-time DB setup if you do not run `render:build`:

```bash
cd backend
npx prisma generate
npx prisma db push
npm run db:seed
```
