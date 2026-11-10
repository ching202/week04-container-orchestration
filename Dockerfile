# Pin the multi-platform index by digest as well as patch and Alpine versions.
ARG NODE_IMAGE=node:24.22.2-alpine3.24@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8
FROM ${NODE_IMAGE} AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/npm-cache \
    && rm -rf /tmp/npm-cache
COPY src ./src
COPY public ./public
COPY tests ./tests
COPY scripts/build.mjs ./scripts/build.mjs
RUN node --test && node scripts/build.mjs

FROM ${NODE_IMAGE} AS runtime
ARG APP_VERSION=1.0.0
ENV NODE_ENV=production PORT=8080 APP_VERSION=${APP_VERSION}
WORKDIR /app
# The official image already creates node with UID/GID 1000.
# Root-owned, read-only application files prevent runtime code modification.
COPY --from=build --chown=root:root /build/dist/ ./
USER 1000:1000
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 CMD ["node", "src/healthcheck.mjs"]
CMD ["node", "src/server.mjs"]
