# Production image — Next.js standalone on Debian Bookworm

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
# Schema must exist before npm ci because package.json postinstall runs prisma generate
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV BETTER_AUTH_SECRET="build-time-secret-not-used-in-prod-32c"
ENV BETTER_AUTH_URL="http://localhost:3000"
# Do NOT set NEXT_PUBLIC_APP_URL here — it gets baked into the client bundle.
# Auth client uses same-origin; Unraid sets BETTER_AUTH_URL at runtime.
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Full Prisma CLI (with transitive deps like `effect`) for migrate deploy at start.
RUN npm install prisma@6.19.3 --omit=dev --no-save \
  && npx prisma generate \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
