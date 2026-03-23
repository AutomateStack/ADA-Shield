const { Queue, Worker } = require('bullmq');
const { scanPage } = require('./scan');
const { calculateRiskScore } = require('./risk-score');
const { logger } = require('./utils/logger');

const QUEUE_NAME = 'accessibility-scans';

/**
 * Creates a BullMQ queue instance for scan jobs.
 * @param {string} redisUrl - Redis connection URL.
 * @returns {Queue} The BullMQ queue.
 */
function createScanQueue(redisUrl) {
  const connection = parseRedisUrl(redisUrl);

  return new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}

/**
 * Adds a scan job to the queue.
 * @param {Queue} queue - The BullMQ queue instance.
 * @param {object} data - Job data.
 * @param {string} data.url - URL to scan.
 * @param {string} [data.siteId] - Site UUID from database.
 * @param {string} [data.userId] - User UUID from database.
 * @param {boolean} [data.isFreeScan=false] - Whether this is a free scan.
 * @param {number} [data.pageLimit=10] - Max pages to crawl.
 * @returns {Promise<import('bullmq').Job>} The created job.
 */
async function addScanJob(queue, data) {
  try {
    const job = await queue.add('scan', {
      url: data.url,
      siteId: data.siteId || null,
      userId: data.userId || null,
      isFreeScan: data.isFreeScan || false,
      pageLimit: data.pageLimit || 10,
      createdAt: new Date().toISOString(),
    });

    logger.info('Scan job added', { jobId: job.id, url: data.url });
    return job;
  } catch (error) {
    logger.error('Failed to add scan job', {
      url: data.url,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Creates a BullMQ worker that processes scan jobs.
 * @param {string} redisUrl - Redis connection URL.
 * @param {object} [deps] - Injectable dependencies (for testing).
 * @param {Function} [deps.onComplete] - Callback after successful scan.
 * @returns {Worker} The BullMQ worker.
 */
function createScanWorker(redisUrl, deps = {}) {
  const connection = parseRedisUrl(redisUrl);

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { url, siteId, userId, isFreeScan, pageLimit } = job.data;

      logger.info('Processing scan job', {
        jobId: job.id,
        url,
        attempt: job.attemptsMade + 1,
      });

      try {
        // Scan the page
        const scanResult = await scanPage(url);

        // Calculate risk score
        const riskResult = calculateRiskScore(scanResult.violations);

        const result = {
          ...scanResult,
          riskScore: riskResult.score,
          riskLevel: riskResult.level,
          riskColor: riskResult.color,
          riskBreakdown: riskResult.breakdown,
          siteId,
          userId,
          isFreeScan,
          jobId: job.id,
        };

        // Call completion handler (e.g., save to database)
        if (deps.onComplete) {
          await deps.onComplete(result);
        }

        logger.info('Scan job completed', {
          jobId: job.id,
          url,
          riskScore: riskResult.score,
        });

        return result;
      } catch (error) {
        logger.error('Scan job failed', {
          jobId: job.id,
          url,
          error: error.message,
          attempt: job.attemptsMade + 1,
        });
        throw error;
      }
    },
    {
      connection,
      concurrency: 2,
      limiter: {
        max: 5,
        duration: 60000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('Job permanently failed', {
      jobId: job?.id,
      error: err.message,
    });
  });

  worker.on('error', (err) => {
    logger.error('Worker error', { error: err.message });
  });

  return worker;
}

/**
 * Parses a Redis URL into a BullMQ-compatible connection object.
 * @param {string} redisUrl - Redis connection URL.
 * @returns {object} Connection config for BullMQ.
 */
function parseRedisUrl(redisUrl) {
  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      password: url.password || undefined,
      username: url.username || undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379 };
  }
}

module.exports = {
  createScanQueue,
  createScanWorker,
  addScanJob,
  QUEUE_NAME,
};
