const { createScanWorker, createScanQueue } = require('./queue');
const { validateConfig } = require('./utils/config');
const { logger } = require('./utils/logger');

/**
 * Standalone worker process for processing scan jobs.
 * Run this separately from the API server: node src/worker.js
 */
async function startWorker() {
  try {
    validateConfig();

    const redisUrl = process.env.REDIS_URL;

    logger.info('Starting scan worker...', { redisUrl: redisUrl ? '[set]' : '[missing]' });

    const worker = createScanWorker(redisUrl, {
      onComplete: async (result) => {
        // In a full setup, this saves to Supabase.
        // The API server handles this via the DB module.
        logger.info('Scan completed — result ready', {
          url: result.url,
          riskScore: result.riskScore,
          totalViolations: result.totalViolations,
        });
      },
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down worker...');
      await worker.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    logger.info('Scan worker started and listening for jobs');
  } catch (error) {
    logger.error('Failed to start worker', { error: error.message });
    process.exit(1);
  }
}

startWorker();
