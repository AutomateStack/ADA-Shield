const { Router } = require('express');
const { getMonitoredSites } = require('../db/sites');
const { saveScanResult, getLatestScanResult, updateSiteLastScanned } = require('../db/scans');
const { getNotificationPrefs } = require('../db/notifications');
const { getUserSubscription } = require('../db/subscriptions');
const { scanPage, calculateRiskScore } = require('@ada-shield/scanner');
const { sendScanCompleteEmail, sendRiskAlertEmail, sendWeeklySummaryEmail } = require('../services/email');
const { logger } = require('../utils/logger');

const router = Router();

/**
 * Internal endpoint to trigger weekly monitoring scans.
 * Runs scans synchronously (no Redis required), saves results, sends emails.
 * Protected by INTERNAL_API_SECRET header.
 */
router.post('/trigger-weekly-scan', async (req, res, next) => {
  try {
    // Verify internal API secret
    const secret = req.headers['x-internal-secret'];
    if (secret !== process.env.INTERNAL_API_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sites = await getMonitoredSites();
    logger.info('Weekly scan triggered', { siteCount: sites.length });

    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
    const results = [];
    // Group sites by user for weekly summary emails
    const userSummaries = {};

    for (const site of sites) {
      try {
        // Skip sites whose owner has no active subscription (monitoring is a paid feature)
        const subscription = await getUserSubscription(site.user_id);
        if (!subscription) {
          logger.info('Skipping weekly scan — no active subscription', {
            siteId: site.id, userId: site.user_id,
          });
          results.push({ siteId: site.id, url: site.url, status: 'skipped' });
          continue;
        }

        // Get previous scan for trend comparison
        const previousScan = await getLatestScanResult(site.id);

        // Run scan synchronously
        const scanResult = await scanPage(site.url);
        const riskResult = calculateRiskScore(scanResult.violations);

        // Save to database
        const saved = await saveScanResult({
          siteId: site.id,
          userId: site.user_id,
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

        await updateSiteLastScanned(site.id);

        // Determine trend
        let trend = 'same';
        if (previousScan) {
          if (riskResult.score > previousScan.risk_score + 5) trend = 'up';
          else if (riskResult.score < previousScan.risk_score - 5) trend = 'down';
        }

        const siteResult = {
          siteId: site.id,
          scanId: saved.id,
          url: site.url,
          name: site.name || new URL(site.url).hostname,
          riskScore: riskResult.score,
          riskLevel: riskResult.level,
          totalViolations: scanResult.totalViolations,
          criticalCount: scanResult.criticalCount,
          seriousCount: scanResult.seriousCount,
          trend,
          status: 'completed',
        };
        results.push(siteResult);

        // Collect for user summary
        const userEmail = site.users?.email;
        if (userEmail) {
          if (!userSummaries[site.user_id]) {
            userSummaries[site.user_id] = { email: userEmail, sites: [] };
          }
          userSummaries[site.user_id].sites.push(siteResult);
        }

        // Send high-risk alert if score >= 70
        if (riskResult.score >= 70 && userEmail) {
          const prefs = await getNotificationPrefs(site.user_id);
          if (prefs.risk_alerts) {
            await sendRiskAlertEmail({
              to: userEmail,
              siteName: site.name || new URL(site.url).hostname,
              siteUrl: site.url,
              riskScore: riskResult.score,
              criticalCount: scanResult.criticalCount,
              seriousCount: scanResult.seriousCount,
              dashboardUrl: `${dashboardUrl}/dashboard/sites/${site.id}`,
            });
          }
        }

        logger.info('Weekly scan completed for site', { siteId: site.id, riskScore: riskResult.score });
      } catch (siteError) {
        logger.error('Weekly scan failed for site', { siteId: site.id, url: site.url, error: siteError.message });
        results.push({ siteId: site.id, url: site.url, status: 'failed', error: siteError.message });
      }
    }

    // Send weekly summary emails to each user
    for (const [userId, summary] of Object.entries(userSummaries)) {
      try {
        const prefs = await getNotificationPrefs(userId);
        if (prefs.weekly_summary) {
          await sendWeeklySummaryEmail({
            to: summary.email,
            sites: summary.sites,
            dashboardUrl: `${dashboardUrl}/dashboard`,
          });
        }
      } catch (emailError) {
        logger.error('Failed to send weekly summary', { userId, error: emailError.message });
      }
    }

    return res.json({
      message: `Processed ${results.length} weekly scans`,
      results,
    });
  } catch (error) {
    next(error);
  }
});

const internalRoutes = router;
module.exports = { internalRoutes };
