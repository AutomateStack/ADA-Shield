const { Router } = require('express');
const { z } = require('zod');
const { scanPage } = require('@ada-shield/scanner');
const { calculateRiskScore } = require('@ada-shield/scanner');
const { saveScanResult, updateSiteLastScanned } = require('../db/scans');
const { getUserSites } = require('../db/sites');
const { getNotificationPrefs } = require('../db/notifications');
const { createRateLimiter } = require('../middleware/rate-limiter');
const { authenticate } = require('../middleware/auth');
const { sendScanCompleteEmail, sendRiskAlertEmail } = require('../services/email');
const { logger } = require('../utils/logger');

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

      // Load user sites to validate ownership of the requested site
      const userSites = await getUserSites(userId);

      // Find the requested site
      const site = userSites.find((s) => s.id === siteId);
      if (!site) {
        return res.status(404).json({ error: 'Site not found' });
      }

      // Run scan synchronously
      logger.info('Authenticated scan started', { siteId, userId, url: site.url });
      const scanResult = await scanPage(site.url);
      const riskResult = calculateRiskScore(scanResult.violations);

      // Save to database
      const saved = await saveScanResult({
        siteId,
        userId,
        url: scanResult.url,
        riskScore: riskResult.score,
        totalViolations: scanResult.totalViolations,
        criticalCount: scanResult.criticalCount,
        seriousCount: scanResult.seriousCount,
        moderateCount: scanResult.moderateCount,
        minorCount: scanResult.minorCount,
        violations: scanResult.violations,
        passedRules: scanResult.passedRules,
        incompleteRules: scanResult.incompleteRules || 0,
        scanDurationMs: scanResult.scanDurationMs,
      });

      await updateSiteLastScanned(siteId);

      // Send notification emails (non-blocking)
      const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
      const userEmail = req.user.email;

      if (userEmail) {
        const prefs = await getNotificationPrefs(userId);
        const siteName = site.name || new URL(site.url).hostname;

        if (prefs.scan_complete) {
          sendScanCompleteEmail({
            to: userEmail,
            siteName,
            siteUrl: site.url,
            riskScore: riskResult.score,
            riskLevel: riskResult.level,
            totalViolations: scanResult.totalViolations,
            criticalCount: scanResult.criticalCount,
            seriousCount: scanResult.seriousCount,
            dashboardUrl: `${dashboardUrl}/dashboard/sites/${siteId}`,
          }).catch(() => {}); // Fire and forget
        }

        if (riskResult.score >= 70 && prefs.risk_alerts) {
          sendRiskAlertEmail({
            to: userEmail,
            siteName,
            siteUrl: site.url,
            riskScore: riskResult.score,
            criticalCount: scanResult.criticalCount,
            seriousCount: scanResult.seriousCount,
            dashboardUrl: `${dashboardUrl}/dashboard/sites/${siteId}`,
          }).catch(() => {}); // Fire and forget
        }
      }

      logger.info('Authenticated scan completed', { siteId, userId, riskScore: riskResult.score });

      return res.json({
        scanId: saved.id,
        status: 'completed',
        url: scanResult.url,
        riskScore: riskResult.score,
        riskLevel: riskResult.level,
        riskColor: riskResult.color,
        totalViolations: scanResult.totalViolations,
        criticalCount: scanResult.criticalCount,
        seriousCount: scanResult.seriousCount,
        moderateCount: scanResult.moderateCount,
        minorCount: scanResult.minorCount,
        violations: scanResult.violations,
        passedRules: scanResult.passedRules,
        scanDurationMs: scanResult.scanDurationMs,
      });
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
