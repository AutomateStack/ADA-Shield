const { Queue, Worker } = require('bullmq');
const { scanPage, calculateRiskScore } = require('@ada-shield/scanner');
const { saveScanResult, updateSiteLastScanned } = require('../db/scans');
const { getNotificationPrefs } = require('../db/notifications');
const { sendScanCompleteEmail, sendRiskAlertEmail } = require('../services/email');
const { logger } = require('../utils/logger');

const QUEUE_NAME = 'accessibility-scans';
const JOB_NAME = 'scan';

let queue = null;

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
      tls: url.protocol === 'rediss:' ? {} : undefined,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379 };
  }
}

/**
 * Initialises the BullMQ scan queue and an embedded worker that saves
 * results to the database and dispatches notification emails.
 * When REDIS_URL is not set the queue is left uninitialised and the
 * route falls back to synchronous processing.
 *
 * @param {string|undefined} redisUrl
 */
function initScanQueue(redisUrl) {
  if (!redisUrl) {
    logger.info('REDIS_URL not set; BullMQ scan queue disabled (synchronous fallback active)');
    return;
  }

  const connection = parseRedisUrl(redisUrl);

  queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { url, siteId, userId, userEmail, siteName } = job.data;

      logger.info('Processing queued scan job', { jobId: job.id, url, siteId });

      const scanResult = await scanPage(url);
      const riskResult = calculateRiskScore(scanResult.violations);

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

      if (userEmail) {
        const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
        const resolvedSiteName = siteName || new URL(url).hostname;
        const prefs = await getNotificationPrefs(userId);

        if (prefs.scan_complete) {
          sendScanCompleteEmail({
            to: userEmail,
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
            to: userEmail,
            siteName: resolvedSiteName,
            siteUrl: url,
            riskScore: riskResult.score,
            criticalCount: scanResult.criticalCount,
            seriousCount: scanResult.seriousCount,
            dashboardUrl: `${dashboardUrl}/dashboard/sites/${siteId}`,
          }).catch(() => {});
        }
      }

      logger.info('Queued scan job completed', { jobId: job.id, siteId, riskScore: riskResult.score });

      return { scanId: saved.id, riskScore: riskResult.score };
    },
    {
      connection,
      concurrency: 2,
      limiter: { max: 5, duration: 60000 },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('Scan job permanently failed', { jobId: job?.id, error: err.message });
  });

  worker.on('error', (err) => {
    logger.error('Scan worker error', { error: err.message });
  });

  logger.info('Scan queue and embedded worker initialised');
}

/**
 * Returns the shared Queue instance, or null if not initialised.
 * @returns {Queue|null}
 */
function getScanQueue() {
  return queue;
}

/**
 * Adds a scan job to the queue.
 * @param {object} data
 * @param {string} data.url
 * @param {string} data.siteId
 * @param {string} data.userId
 * @param {number} [data.pageLimit]
 * @param {string} [data.userEmail]
 * @param {string} [data.siteName]
 * @returns {Promise<import('bullmq').Job>}
 */
async function enqueueScan(data) {
  if (!queue) throw new Error('Scan queue not initialised');
  return queue.add(JOB_NAME, {
    url: data.url,
    siteId: data.siteId || null,
    userId: data.userId || null,
    isFreeScan: false,
    pageLimit: data.pageLimit || 10,
    userEmail: data.userEmail || null,
    siteName: data.siteName || null,
    createdAt: new Date().toISOString(),
  });
}

module.exports = { initScanQueue, getScanQueue, enqueueScan };
