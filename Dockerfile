# ============================================================
# Serika Maps — Multi-stage Docker Build
# Builds: Next.js web frontend + Elysia API backend
# Runtime: oven/bun (Alpine)
#
# Environment variables (set at runtime via .env or -e flags):
#   PUBLIC_URL      — Public URL of the web frontend
#   PUBLIC_URL_API  — Public URL of the API backend
# ============================================================

# ── Base ─────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS base
WORKDIR /app

# ── Install API deps ────────────────────────────────────────
FROM base AS api-deps
COPY api/package.json api/bun.lock ./api/
RUN cd api && bun install --frozen-lockfile --production

# ── Install Web deps ────────────────────────────────────────
FROM base AS web-deps
COPY web/package.json web/bun.lock ./web/
RUN cd web && bun install --frozen-lockfile

# ── Build Web ───────────────────────────────────────────────
FROM base AS web-builder
ARG NEXT_PUBLIC_API_URL=http://localhost:4001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=web-deps /app/web/node_modules ./web/node_modules
COPY web/ ./web/
RUN cd web && bun run build

# ── Production Image ────────────────────────────────────────
FROM base AS production

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Default env vars (override at runtime)
ENV PUBLIC_URL=http://localhost:3000
ENV PUBLIC_URL_API=http://localhost:4001

# API
COPY --from=api-deps /app/api/node_modules ./api/node_modules
COPY api/ ./api/

# Web (built output + runtime deps)
COPY --from=web-builder /app/web/.next ./web/.next
COPY --from=web-builder /app/web/node_modules ./web/node_modules
COPY --from=web-builder /app/web/package.json ./web/package.json
COPY --from=web-builder /app/web/next.config.ts ./web/next.config.ts
COPY --from=web-builder /app/web/public ./web/public

# Entrypoint script
COPY <<'EOF' /app/start.sh
#!/bin/sh
set -e

echo "🗺️  Serika Maps"
echo "   PUBLIC_URL     = ${PUBLIC_URL}"
echo "   PUBLIC_URL_API = ${PUBLIC_URL_API}"
echo ""
echo "   Web  → :3000"
echo "   API  → :4001"

# Start API in background
cd /app/api && bun run start &
API_PID=$!

# Start Web
cd /app/web && bun run start &
WEB_PID=$!

# Trap signals for graceful shutdown
trap "kill $API_PID $WEB_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# Wait for either to exit
wait -n $API_PID $WEB_PID
EOF
RUN chmod +x /app/start.sh

EXPOSE 3000 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4001/ || exit 1

CMD ["/bin/sh", "/app/start.sh"]
