const { Router } = require('express');
const { z } = require('zod');
const { authenticate } = require('../middleware/auth');
const { getUserSubscription, PLAN_LIMITS } = require('../db/subscriptions');
const { createSite, getUserSites, getUserSiteById, deleteSite } = require('../db/sites');
const { logger } = require('../utils/logger');

const router = Router();

const createSiteSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
  name: z.string().max(100).optional(),
});

// ── List Sites ──────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const sites = await getUserSites(req.user.id);
    return res.json({ sites });
  } catch (error) {
    next(error);
  }
});

// ── Create Site ─────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const parsed = createSiteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = req.user.id;
    let { url, name } = parsed.data;

    // Normalize URL — add https:// if scheme is missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    // Enforce plan site limits
    const subscription = await getUserSubscription(userId);
    const plan = subscription?.plan || 'free';
    const limits = PLAN_LIMITS[plan] || { pagesLimit: 1, sitesLimit: 1 };

    const existingSites = await getUserSites(userId);
    if (existingSites.length >= limits.sitesLimit) {
      return res.status(403).json({
        error: 'Site limit reached',
        message: `Your ${plan} plan allows ${limits.sitesLimit} site(s). Upgrade to add more.`,
        upgradeRequired: true,
      });
    }

    const site = await createSite({
      userId,
      url,
      name: name || new URL(url).hostname,
    });

    logger.info('Site created', { siteId: site.id, userId, url });
    return res.status(201).json({ site });
  } catch (error) {
    next(error);
  }
});

// ── Delete Site ─────────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id: siteId } = req.params;
    const userId = req.user.id;

    // Verify ownership before deleting
    const site = await getUserSiteById(siteId, userId);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    await deleteSite(siteId);
    logger.info('Site deleted', { siteId, userId });
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

const siteRoutes = router;
module.exports = { siteRoutes };
