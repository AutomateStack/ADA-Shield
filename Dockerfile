# ── ADA Shield API — Railway Production Dockerfile ──────────────────
# Uses Node 20 slim + system Chromium (avoids downloading ~300MB Chrome
# binary at runtime and prevents the OOM issues seen on Render Free).
# Total image is ~500MB compressed.

FROM node:20-slim

# ── Chrome / Puppeteer OS dependencies ──────────────────────────────
# Install system Chromium and all required shared libraries.
# Using --no-install-recommends keeps the layer lean.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libgbm1 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libglib2.0-0 \
    libasound2 \
    fonts-liberation \
    fonts-freefont-ttf \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ── Tell Puppeteer to use the system Chrome ──────────────────────────
# Skip downloading Puppeteer's bundled Chrome — we use the system one.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# ── Railway memory-friendly defaults (can be overridden via Railway UI) ──
# Railway Hobby plan has 8 GB RAM so the pool and concurrency can be
# enabled without hitting OOM. Adjust these in Railway env if needed.
ENV SCANNER_BROWSER_POOL=true
ENV SCAN_WORKER_CONCURRENCY=2
ENV NODE_ENV=production

WORKDIR /app

# ── Install dependencies ─────────────────────────────────────────────
# Copy root workspace manifest and package-lock first so Docker can
# cache node_modules as long as deps don't change.
COPY package.json package-lock.json ./
COPY packages/api/package.json     ./packages/api/
COPY packages/scanner/package.json ./packages/scanner/
# Dashboard is deployed separately to Vercel — no need to include it.
RUN npm ci --omit=dev --workspace=packages/api --workspace=packages/scanner

# ── Copy application source ──────────────────────────────────────────
COPY packages/api     ./packages/api
COPY packages/scanner ./packages/scanner

# ── Runtime ─────────────────────────────────────────────────────────
# Railway injects PORT automatically.
EXPOSE 4000
CMD ["node", "packages/api/src/index.js"]
