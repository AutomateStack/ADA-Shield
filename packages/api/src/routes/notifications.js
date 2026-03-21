const { Router } = require('express');
const { z } = require('zod');
const { authenticate } = require('../middleware/auth');
const { getNotificationPrefs, updateNotificationPrefs } = require('../db/notifications');
const { logger } = require('../utils/logger');

const router = Router();

const prefsSchema = z.object({
  scan_complete: z.boolean().optional(),
  risk_alerts: z.boolean().optional(),
  weekly_summary: z.boolean().optional(),
});

// ── Get Notification Preferences ────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const prefs = await getNotificationPrefs(req.user.id);
    return res.json({
      scanComplete: prefs.scan_complete,
      riskAlerts: prefs.risk_alerts,
      weeklySummary: prefs.weekly_summary,
    });
  } catch (error) {
    next(error);
  }
});

// ── Update Notification Preferences ─────────────────────────────────
router.put('/', authenticate, async (req, res, next) => {
  try {
    const parsed = prefsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const prefs = await updateNotificationPrefs(req.user.id, parsed.data);
    logger.info('Notification prefs updated via API', { userId: req.user.id });

    return res.json({
      scanComplete: prefs.scan_complete,
      riskAlerts: prefs.risk_alerts,
      weeklySummary: prefs.weekly_summary,
    });
  } catch (error) {
    next(error);
  }
});

const notificationRoutes = router;
module.exports = { notificationRoutes };
