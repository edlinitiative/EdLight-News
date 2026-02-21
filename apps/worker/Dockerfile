FROM node:20-slim AS base

# Install Chromium for Playwright-based image rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libnspr4 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
 && rm -rf /var/lib/apt/lists/*

# Tell playwright-core where to find the system Chromium
ENV PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
WORKDIR /app

# install deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/types/package.json packages/types/package.json
COPY packages/firebase/package.json packages/firebase/package.json
COPY packages/scraper/package.json packages/scraper/package.json
COPY packages/generator/package.json packages/generator/package.json
COPY packages/renderer/package.json packages/renderer/package.json
COPY packages/publisher/package.json packages/publisher/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN pnpm install --frozen-lockfile

# copy source & build
COPY packages packages
COPY apps/worker apps/worker
COPY tsconfig.base.json ./
RUN pnpm --filter @edlight-news/worker... build

EXPOSE 8080
CMD ["node", "apps/worker/dist/index.js"]
