const { Queue, Worker } = require('bullmq');
const { scanPage, calculateRiskScore } = require('@ada-shield/scanner');
const { saveScanResult, updateSiteLastScanned } = require('../db/scans');
const { getNotificationPrefs } = require('../db/notifications');
const { sendScanCompleteEmail, sendRiskAlertEmail } = require('./email');
const { logger } = require('../utils/logger');

const QUEUE_NAME = 'accessibility-scans';

let scanQueue = null;
let scanWorker = null;

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Parses a Redis URL into a BullMQ-compatible connection object.
 * @param {string} redisUrl
 * @returns {object}
 */
function parseRedisUrl(redisUrl) {
  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      password: url.password || undefined,
      username: url.username || undefined,
      tls: url.protocol === 'rediss:' ? { rejectUnauthorized: true } : undefined,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379 };
  }
}

/**
 * Initialises the BullMQ scan queue singleton.
 * No-ops if REDIS_URL is not set.
 */
function initScanQueue() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || scanQueue) return scanQueue;

  const connection = parseRedisUrl(redisUrl);
  scanQueue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

  logger.info('Scan queue initialised');
  return scanQueue;
}

/**
 * Returns the current queue instance (null if not initialised).
 * @returns {Queue|null}
 */
function getScanQueue() {
  return scanQueue;
}

/**
 * Enqueues an authenticated scan job.
 * @param {object} data
 * @param {string} data.url
 * @param {string} data.siteId
 * @param {string} data.userId
 * @param {string} [data.userEmail]
 * @param {string} [data.siteName]
 * @param {number} [data.pageLimit]
 * @returns {Promise<import('bullmq').Job>}
 */
async function enqueueScanJob(data) {
  const queue = getScanQueue();
  if (!queue) {
    throw new Error('Scan queue is not available — REDIS_URL is not configured');
  }

  const job = await queue.add('scan', {
    url: data.url,
    siteId: data.siteId,
    userId: data.userId,
    userEmail: data.userEmail || null,
    siteName: data.siteName || null,
    pageLimit: data.pageLimit || 10,
    createdAt: new Date().toISOString(),
  });

  logger.info('Scan job enqueued', { jobId: job.id, url: data.url });
  return job;
}

/**
 * Returns the current state and return value of a scan job.
 * @param {string} jobId
 * @returns {Promise<{jobId: string, state: string, returnValue: object|null, failedReason: string|null}|null>}
 */
async function getScanJobStatus(jobId) {
  const queue = getScanQueue();
  if (!queue) return null;

  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  return {
    jobId: job.id,
    userId: job.data?.userId || null,
    state,
    returnValue: job.returnvalue || null,
    failedReason: job.failedReason || null,
  };
}

/**
 * Starts an in-process BullMQ worker that processes scan jobs, saves results,
 * and sends notification emails.  No-ops if REDIS_URL is not set or if the
 * worker has already been started.
 * @returns {Worker|null}
 */
function initScanWorker() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || scanWorker) return scanWorker;

  const connection = parseRedisUrl(redisUrl);
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
  const workerConcurrency = parsePositiveInt(process.env.SCAN_WORKER_CONCURRENCY, 2);

  scanWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { url, siteId, userId, userEmail, siteOwnerEmail, siteName, pageLimit } = job.data;

      logger.info('Processing scan job', { jobId: job.id, url, attempt: job.attemptsMade + 1 });

      // Run accessibility scan
      // NOTE: pageLimit is stored in job data for future multi-page crawling support.
      // Currently only the entry URL is scanned.
      if (pageLimit > 1) {
        logger.warn('pageLimit > 1 requested but multi-page crawling is not yet implemented; scanning entry URL only', {
          jobId: job.id, url, pageLimit,
        });
      }
      const scanResult = await scanPage(url);
      const riskResult = calculateRiskScore(scanResult.violations);

      // Persist results
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
        jobId: job.id,
      });

      await updateSiteLastScanned(siteId);

      // Send notification emails (non-blocking)
      // Collect recipients: user + site owner (if different)
      const recipients = new Set();
      if (userEmail) recipients.add(userEmail);
      if (siteOwnerEmail && siteOwnerEmail !== userEmail) recipients.add(siteOwnerEmail);

      if (recipients.size > 0) {
        const prefs = await getNotificationPrefs(userId);
        const resolvedSiteName = siteName || new URL(url).hostname;

        // Send to each recipient
        recipients.forEach((recipient) => {
          if (prefs.scan_complete) {
            sendScanCompleteEmail({
              to: recipient,
              siteName: resolvedSiteName,
              siteUrl: url,
              riskScore: riskResult.score,
              riskLevel: riskResult.level,
              totalViolations: scanResult.totalViolations,
              criticalCount: scanResult.criticalCount,
              seriousCount: scanResult.seriousCount,
              dashboardUrl: `${dashboardUrl}/dashboard/sites/${siteId}`,
            }).catch(() => {});
          }

          if (riskResult.score >= 70 && prefs.risk_alerts) {
            sendRiskAlertEmail({
              to: recipient,
              siteName: resolvedSiteName,
              siteUrl: url,
              riskScore: riskResult.score,
              criticalCount: scanResult.criticalCount,
              seriousCount: scanResult.seriousCount,
              dashboardUrl: `${dashboardUrl}/dashboard/sites/${siteId}`,
            }).catch(() => {});
          }
        });
      }

      logger.info('Scan job completed', { jobId: job.id, url, riskScore: riskResult.score });

      return {
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
      };
    },
    {
      connection,
      concurrency: workerConcurrency,
      limiter: { max: 5, duration: 60000 },
    }
  );

  scanWorker.on('failed', (job, err) => {
    logger.error('Scan job permanently failed', { jobId: job?.id, error: err.message });
  });

  scanWorker.on('error', (err) => {
    logger.error('Scan worker error', { error: err.message });
  });

  logger.info('Scan worker initialised', { concurrency: workerConcurrency });
  return scanWorker;
}

module.exports = {
  initScanQueue,
  getScanQueue,
  enqueueScanJob,
  getScanJobStatus,
  initScanWorker,
};
