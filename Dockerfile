# ============================================================
# Serika Maps — Multi-stage Docker Build
# Builds: Next.js web frontend + Elysia API backend
# Runtime: oven/bun (Alpine)
# ============================================================

# ---- Base ----
FROM oven/bun:1-alpine AS base
WORKDIR /app

# ---- Install API deps ----
FROM base AS api-deps
COPY api/package.json api/bun.lock ./api/
RUN cd api && bun install --frozen-lockfile --production

# ---- Install Web deps ----
FROM base AS web-deps
COPY web/package.json web/bun.lock ./web/
RUN cd web && bun install --frozen-lockfile

# ---- Build Web ----
FROM base AS web-builder
COPY --from=web-deps /app/web/node_modules ./web/node_modules
COPY web/ ./web/
RUN cd web && bun run build

# ---- Production Image ----
FROM base AS production

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# API
COPY --from=api-deps /app/api/node_modules ./api/node_modules
COPY api/ ./api/

# Web (standalone output + static assets)
COPY --from=web-builder /app/web/.next ./.next-build
COPY --from=web-builder /app/web/node_modules ./web/node_modules
COPY --from=web-builder /app/web/package.json ./web/package.json
COPY --from=web-builder /app/web/next.config.ts ./web/next.config.ts
COPY --from=web-builder /app/web/public ./web/public
COPY --from=web-builder /app/web/.next ./web/.next

# Supervisor script to run both services
COPY <<'EOF' /app/start.sh
#!/bin/sh
echo "🚀 Starting Serika Maps..."
echo "   API  → :4001"
echo "   Web  → :3000"

# Start API in background
cd /app/api && bun run start &
API_PID=$!

# Start Web
cd /app/web && bun run start &
WEB_PID=$!

# Wait for either to exit
wait -n $API_PID $WEB_PID
EOF
RUN chmod +x /app/start.sh

EXPOSE 3000 4001

CMD ["/bin/sh", "/app/start.sh"]
