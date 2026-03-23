const { Router } = require('express');
const { logger } = require('../utils/logger');
const {
  getAdminStats,
  getAdminScans,
  getTopScannedUrls,
  getAdminUsers,
  getAdminSubscriptions,
  getAdminScanDetail,
} = require('../db/admin');

const router = Router();

/**
 * Admin auth middleware — validates INTERNAL_API_SECRET header.
 * Used for all admin routes to protect sensitive data.
 */
function adminAuth(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized — invalid admin secret' });
  }
  next();
}

// Apply admin auth to all routes
router.use(adminAuth);

// ── Overview Stats ──────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getAdminStats();
    return res.json(stats);
  } catch (error) {
    next(error);
  }
});

// ── Recent Scans ────────────────────────────────────────────────────
router.get('/scans', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const type = ['free', 'authenticated'].includes(req.query.type) ? req.query.type : undefined;

    const result = await getAdminScans({ page, limit, type });
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── Top Scanned URLs ────────────────────────────────────────────────
router.get('/scans/top-urls', async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const topUrls = await getTopScannedUrls(limit);
    return res.json(topUrls);
  } catch (error) {
    next(error);
  }
});

// ── Scan Detail ─────────────────────────────────────────────────────
router.get('/scans/:scanId', async (req, res, next) => {
  try {
    const scan = await getAdminScanDetail(req.params.scanId);
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    return res.json(scan);
  } catch (error) {
    next(error);
  }
});

// ── Users ───────────────────────────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const result = await getAdminUsers({ page, limit });
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── Subscriptions ───────────────────────────────────────────────────
router.get('/subscriptions', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const result = await getAdminSubscriptions({ page, limit });
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

const adminRoutes = router;
module.exports = { adminRoutes };
