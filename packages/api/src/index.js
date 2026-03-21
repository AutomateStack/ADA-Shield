const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { logger } = require('./utils/logger');
const { validateConfig } = require('./utils/config');
const { scanRoutes } = require('./routes/scan');
const { webhookRoutes } = require('./routes/webhooks');
const { internalRoutes } = require('./routes/internal');
const { billingRoutes } = require('./routes/billing');
const { notificationRoutes } = require('./routes/notifications');
const { errorHandler } = require('./middleware/error-handler');
const { createRateLimiter } = require('./middleware/rate-limiter');

// Validate environment variables at startup
validateConfig();

const app = express();
const PORT = process.env.PORT || 4000;

// ── Global Middleware ───────────────────────────────────────────────
// Stripe webhooks need raw body, so mount webhook route BEFORE json parser
app.use('/api/webhooks/stripe', webhookRoutes);

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
app.use('/api/billing', billingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/internal', internalRoutes);

// ── 404 Handler ─────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error Handler ───────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`ADA Shield API running on port ${PORT}`, {
    env: process.env.NODE_ENV,
    port: PORT,
  });
});

module.exports = { app };
