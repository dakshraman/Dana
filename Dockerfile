# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
# Prisma generate only needs a syntactically valid datasource URL. The real
# connection string is supplied at runtime.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db"
ENV DIRECT_URL="postgresql://user:password@localhost:5432/db"

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# verify-full TLS needs the CA bundle at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/certs ./certs

RUN mkdir -p /app/storage/attachments \
  && chown -R nextjs:nodejs /app/storage

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
