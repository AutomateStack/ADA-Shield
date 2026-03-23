const { Router } = require('express');
const { z } = require('zod');
const { scanPage } = require('@ada-shield/scanner');
const { calculateRiskScore } = require('@ada-shield/scanner');
const { getUserSubscription, PLAN_LIMITS } = require('../db/subscriptions');
const { getUserSites } = require('../db/sites');
const { createRateLimiter } = require('../middleware/rate-limiter');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { enqueueScanJob, getScanJobStatus } = require('../services/scan-queue');

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────

const freeScanSchema = z.object({
  url: z
    .string()
    .url('Please enter a valid URL')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'URL must start with http:// or https://'
    ),
});

const authenticatedScanSchema = z.object({
  siteId: z.string().uuid('Invalid site ID'),
});

// ── Free Scan Endpoint ──────────────────────────────────────────────
// Rate limited: 10 per hour per IP
router.post(
  '/free',
  createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }),
  async (req, res, next) => {
    try {
      const parsed = freeScanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { url } = parsed.data;

      logger.info('Free scan requested', { url, ip: req.ip });

      // Run scan synchronously for free scans (up to 3 pages)
      const scanResult = await scanPage(url);
      const riskResult = calculateRiskScore(scanResult.violations);

      // Free scan: return risk score + first 3 violations only
      const limitedViolations = scanResult.violations.slice(0, 3);
      const hiddenCount = Math.max(0, scanResult.violations.length - 3);

      return res.json({
        url: scanResult.url,
        scannedAt: scanResult.scannedAt,
        riskScore: riskResult.score,
        riskLevel: riskResult.level,
        riskColor: riskResult.color,
        totalViolations: scanResult.totalViolations,
        criticalCount: scanResult.criticalCount,
        seriousCount: scanResult.seriousCount,
        moderateCount: scanResult.moderateCount,
        minorCount: scanResult.minorCount,
        violations: limitedViolations,
        hiddenViolations: hiddenCount,
        passedRules: scanResult.passedRules,
        scanDurationMs: scanResult.scanDurationMs,
        isFreeScan: true,
        message:
          hiddenCount > 0
            ? `${hiddenCount} more violations found — sign up to see all`
            : undefined,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ── Authenticated Scan Endpoint ─────────────────────────────────────
router.post(
  '/run',
  authenticate,
  async (req, res, next) => {
    try {
      const parsed = authenticatedScanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { siteId } = parsed.data;
      const userId = req.user.id;

      // Check subscription and enforce plan limits
      const subscription = await getUserSubscription(userId);
      const plan = subscription?.plan || 'free';
      const limits = PLAN_LIMITS[plan] || { pagesLimit: 1, sitesLimit: 1 };

      // Check site limit
      const userSites = await getUserSites(userId);
      if (userSites.length > limits.sitesLimit) {
        return res.status(403).json({
          error: 'Site limit reached',
          message: `Your ${plan} plan allows ${limits.sitesLimit} site(s). Upgrade to add more.`,
          upgradeRequired: true,
        });
      }

      // Find the requested site
      const site = userSites.find((s) => s.id === siteId);
      if (!site) {
        return res.status(404).json({ error: 'Site not found' });
      }

      // Compute effective page limit (capped to the plan's maximum)
      const effectivePageLimit = limits.pagesLimit;

      // Enqueue the scan job via BullMQ
      logger.info('Authenticated scan queued', { siteId, userId, url: site.url, effectivePageLimit });

      const job = await enqueueScanJob({
        url: site.url,
        siteId,
        userId,
        userEmail: req.user.email || null,
        siteName: site.name || new URL(site.url).hostname,
        pageLimit: effectivePageLimit,
      });

      return res.json({
        jobId: job.id,
        status: 'queued',
        message: 'Scan queued. Poll /api/scan/status/:jobId for results.',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ── Scan Job Status Endpoint ────────────────────────────────────────
router.get(
  '/status/:jobId',
  authenticate,
  async (req, res, next) => {
    try {
      const { jobId } = req.params;
      const status = await getScanJobStatus(jobId);
      if (!status) {
        return res.status(404).json({ error: 'Job not found' });
      }
      return res.json(status);
    } catch (error) {
      next(error);
    }
  }
);

// ── Get Scan Results for a Site ─────────────────────────────────────
router.get(
  '/results/:siteId',
  authenticate,
  async (req, res, next) => {
    try {
      const { siteId } = req.params;
      const { getScanResults } = require('../db/scans');
      const results = await getScanResults(siteId);
      return res.json({ results });
    } catch (error) {
      next(error);
    }
  }
);

const scanRoutes = router;
module.exports = { scanRoutes };
