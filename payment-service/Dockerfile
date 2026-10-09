FROM node:22-bookworm-slim AS base

# Prisma's query engine needs OpenSSL at build time and at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------- build: all deps + generated Prisma client ----------
FROM base AS build

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

# ---------- migrate: one-shot job (docker compose runs this before the app) ----------
# The prisma CLI is a devDependency here, so it only exists in this target
# (not in the runtime image).
FROM build AS migrate

ENV NODE_ENV=production
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------- prod-deps: build output minus devDependencies ----------
FROM build AS prod-deps

RUN npm prune --omit=dev --legacy-peer-deps

# ---------- runtime (default target) ----------
FROM base AS runtime

ENV NODE_ENV=production \
    PORT=4006

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

USER node

EXPOSE 4006

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
    CMD node -e "require('http').get('http://127.0.0.1:'+process.env.PORT+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "index.js"]