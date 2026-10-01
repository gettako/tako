# Stage 1: Install dependencies and build
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy package manifests for workspace
COPY package.json bun.lock ./
COPY console/package.json ./console/

RUN bun install --frozen-lockfile

# Copy web app source code
COPY console ./console

WORKDIR /app/console
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TAKO_BACKEND_URL=http://server:8080
ENV NEXT_PUBLIC_API_MODE=live
RUN bun run build

# Stage 2: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output and static assets
COPY --from=builder --chown=nextjs:nodejs /app/console/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/console/.next/static ./console/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/console/public ./console/public

USER nextjs

EXPOSE 3000

CMD ["node", "console/server.js"]

