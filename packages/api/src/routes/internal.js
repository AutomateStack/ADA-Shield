const { Router } = require('express');
const { getMonitoredSites } = require('../db/sites');
const { addScanJob, createScanQueue } = require('@ada-shield/scanner');
const { logger } = require('../utils/logger');

const router = Router();

/**
 * Internal endpoint to trigger weekly monitoring scans.
 * Protected by INTERNAL_API_SECRET header.
 * Called by GitHub Actions weekly-monitor workflow.
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

    const queue = createScanQueue(process.env.REDIS_URL);
    const jobs = [];

    for (const site of sites) {
      const job = await addScanJob(queue, {
        url: site.url,
        siteId: site.id,
        userId: site.user_id,
        isFreeScan: false,
        pageLimit: site.pages_to_scan || 10,
      });
      jobs.push({ siteId: site.id, jobId: job.id, url: site.url });
    }

    return res.json({
      message: `Queued ${jobs.length} weekly scans`,
      jobs,
    });
  } catch (error) {
    next(error);
  }
});

const internalRoutes = router;
module.exports = { internalRoutes };
