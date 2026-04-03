const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const { logger } = require('./utils/logger');
const { validateConfig } = require('./utils/config');
const { scanRoutes } = require('./routes/scan');
const { webhookRoutes, gumroadWebhookRoutes } = require('./routes/webhooks');
const { internalRoutes } = require('./routes/internal');
const { billingRoutes } = require('./routes/billing');
const { notificationRoutes } = require('./routes/notifications');
const { adminRoutes } = require('./routes/admin');
const { siteRoutes } = require('./routes/sites');
const { errorHandler } = require('./middleware/error-handler');
const { createRateLimiter } = require('./middleware/rate-limiter');
const { initScanQueue, initScanWorker } = require('./services/scan-queue');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Request ID Middleware ───────────────────────────────────────────
// Assigns a unique request ID for log correlation across the request lifecycle.
app.use((req, _res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  next();
});

// ── Global Middleware ───────────────────────────────────────────────
// Stripe webhooks need raw body, so mount webhook route BEFORE json parser
app.use('/api/webhooks/stripe', webhookRoutes);
// Gumroad sends urlencoded body — mount before json parser too
app.use('/api/webhooks/gumroad', gumroadWebhookRoutes);

app.use(helmet());

const allowedOrigins = [
  'http://localhost:3000',
  process.env.DASHBOARD_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Global rate limiter: 100 requests per 15 minutes per IP
app.use(createRateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }));

// ── Health Check ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ──────────────────────────────────────────────────────
app.use('/api/scan', scanRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/admin', adminRoutes);

// ── 404 Handler ─────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error Handler ───────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────────────
// Bind the port FIRST so the process is always reachable, then validate
// config and initialise optional services (queue, worker).
app.listen(PORT, () => {
  logger.info(`ADA Shield API running on port ${PORT}`, {
    env: process.env.NODE_ENV,
    port: PORT,
  });

  // Validate required env vars after binding — missing vars log an error
  // but do NOT crash the process so the health check stays reachable.
  try {
    validateConfig();
  } catch (err) {
    logger.error('Configuration error — some features may be unavailable', {
      error: err.message,
    });
  }

  // Initialise BullMQ queue and in-process worker (no-ops if REDIS_URL is absent)
  initScanQueue();
  initScanWorker();
});

module.exports = { app };
