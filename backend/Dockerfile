# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install ALL deps (including dev) for build
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

COPY src ./src/
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install ALL deps (we need ts-node + typescript for seed)
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Copy Prisma schema + generated client + seed
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Entrypoint script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Font assets for PDF reports (Cyrillic support)
COPY assets ./assets

# Uploads directory
RUN mkdir -p uploads

EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]
