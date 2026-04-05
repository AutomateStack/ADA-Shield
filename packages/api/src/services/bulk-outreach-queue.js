/**
 * Bulk Outreach Queue
 *
 * Processes sites imported from Excel.  For each site it:
 *   1. Scans the site (Puppeteer + axe-core via scanner package).
 *   2. Saves the scan result.
 *   3. Sends a tracked outreach email.
 *   4. Records contact history with tracking tokens.
 *
 * Daily cap: only 2 sites are processed per day, enforced by the
 * 'daily-bulk-trigger' repeatable job that enqueues at most 2 pending
 * sites each morning.
 *
 * All operations are read-only wrappers around existing helpers to avoid
 * duplicating business logic.
 */

const crypto = require('crypto');
const { Queue, Worker, QueueScheduler } = require('bullmq');
const { scanPage, calculateRiskScore } = require('@ada-shield/scanner');
const { saveScanResult } = require('../db/scans');
const { supabase } = require('../db/supabase');
const {
  getSiteById,
  getLatestSiteScanSummary,
  createSiteContactHistoryEntry,
  updateSiteContactHistoryEntry,
} = require('../db/admin');
const { invokeSupabaseFunction } = require('../services/supabase-functions');
const { sendEmail, detectIndustry, getIndustryContext } = require('../services/email');
const { scheduleFollowUp } = require('./outreach-queue');
const {
  buildReportUrl,
  buildTrackingUrls,
  buildTrackedEmailHtml,
  injectTrackedLink,
} = require('./outreach-tracking');
const { logger } = require('../utils/logger');

const BULK_QUEUE_NAME = 'bulk-outreach';
const DAILY_LIMIT = 2; // max sites processed per day

let bulkQueue = null;
let bulkWorker = null;

// ── Redis helpers (reuse same logic as scan-queue) ─────────────────

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

function getBulkQueue() {
  return bulkQueue;
}

// ── Queue init ─────────────────────────────────────────────────────

function initBulkQueue() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || bulkQueue) return bulkQueue;

  const connection = parseRedisUrl(redisUrl);
  bulkQueue = new Queue(BULK_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 100 },
    },
  });

  logger.info('Bulk outreach queue initialised');
  return bulkQueue;
}

// ── Schedule a single site for bulk processing ─────────────────────

/**
 * Enqueues one site for scanning + emailing.
 * @param {object} params
 * @param {string} params.siteId
 * @param {string} params.batchId   — UUID of the bulk_import_batch row
 */
async function enqueueBulkSite({ siteId, batchId }) {
  const queue = getBulkQueue();
  if (!queue) {
    throw new Error('Bulk outreach queue not available — REDIS_URL not configured');
  }
  const job = await queue.add('process-site', { siteId, batchId }, {
    jobId: `bulk-${siteId}`, // deduplicate: one job per site ever
  });
  logger.info('Bulk site enqueued', { jobId: job.id, siteId });
  return job;
}

// ── Daily trigger job ──────────────────────────────────────────────

/**
 * Registers a repeatable cron job that fires every day at 09:00 UTC.
 * Each fire picks the next DAILY_LIMIT pending sites and enqueues them.
 */
async function scheduleDailyTrigger() {
  const queue = getBulkQueue();
  if (!queue) return;

  await queue.add(
    'daily-trigger',
    {},
    {
      repeat: { cron: '0 9 * * *' },
      jobId: 'bulk-daily-trigger',
    }
  );
  logger.info('Daily bulk trigger scheduled (09:00 UTC, 2 sites/day)');
}

// ── Core processing logic ──────────────────────────────────────────

async function processOneSite(siteId, batchId) {
  const site = await getSiteById(siteId);
  if (!site) throw new Error(`Site ${siteId} not found`);

  // 1. Scan
  logger.info('Bulk: scanning site', { siteId, url: site.url });
  let scanData;
  try {
    scanData = await scanPage(site.url, { pageLimit: 1 });
  } catch (scanErr) {
    throw new Error(`Scan failed for ${site.url}: ${scanErr.message}`);
  }

  const riskScore = calculateRiskScore(scanData.violations || []);
  const industry = detectIndustry(site.url, site.name);
  const industryCtx = getIndustryContext(industry);

  // 2. Save scan result
  const publicToken = crypto.randomUUID();
  const scanRecord = await saveScanResult({
    siteId: site.id,
    userId: null,
    url: site.url,
    violations: scanData.violations || [],
    riskScore,
    pagesScanned: scanData.pagesScanned || 1,
    publicToken,
  });

  // 3. Build email
  const recipients = [
    site.owner_email,
    ...(site.notification_recipients || []),
  ].filter(Boolean);

  if (recipients.length === 0) {
    logger.warn('Bulk: site has no recipient emails, skipping email step', { siteId });
    return { siteId, scanned: true, emailed: false };
  }

  const reportUrl = buildReportUrl(publicToken);
  const siteName = site.name || new URL(site.url).hostname;
  const sendBatchId = crypto.randomUUID();

  const subject =
    riskScore >= 70
      ? `⚠️ ${siteName} has a high ADA lawsuit risk (${riskScore}/100)`
      : `Your free ADA accessibility report for ${siteName}`;

  const violationCount = (scanData.violations || []).length;
  const message = `Hi there,

I scanned ${siteName} and found ${violationCount} accessibility issue${violationCount !== 1 ? 's' : ''} that could expose you to ADA lawsuits.

Your risk score: ${riskScore}/100${riskScore >= 70 ? ' — HIGH RISK' : riskScore >= 40 ? ' — MEDIUM RISK' : ' — LOW RISK'}.

${industryCtx ? `${industryCtx}\n\n` : ''}View your full free report with specific code fixes below.

Thirmal
ADA Shield`;

  const sentRecipients = [];

  for (let idx = 0; idx < recipients.length; idx++) {
    const recipient = recipients[idx];
    const trackingToken = crypto.randomUUID();
    const trackingUrls = buildTrackingUrls(trackingToken, reportUrl);
    const trackedText = injectTrackedLink(message, trackingUrls.trackedReportUrl);
    const trackedHtml = buildTrackedEmailHtml({
      subject,
      message,
      siteName,
      siteUrl: site.url,
      trackedReportUrl: trackingUrls.trackedReportUrl,
      trackingPixelUrl: trackingUrls.trackingPixelUrl,
    });

    const contactEntry = await createSiteContactHistoryEntry({
      siteId: site.id,
      recipientEmail: recipient,
      subject,
      message: trackedText,
      templateStyle: riskScore >= 70 ? 'fear_urgency' : 'friendly_educational',
      deliveryChannel: 'supabase-function',
      deliveryStatus: 'sent',
      providerMessageId: null,
      sendBatchId,
      scanId: scanRecord?.id || null,
      reportUrl: trackingUrls.reportUrl,
      trackedReportUrl: trackingUrls.trackedReportUrl,
      trackingPixelUrl: trackingUrls.trackingPixelUrl,
      automationEnabled: true,
      trackingToken,
    });

    let deliveryChannel = 'supabase-function';
    let providerMessageId = null;

    try {
      const resp = await invokeSupabaseFunction('send-admin-email', {
        to: [recipient],
        subject,
        message: trackedText,
        text: trackedText,
        html: trackedHtml,
        siteId: site.id,
        siteName,
        siteUrl: site.url,
      });
      providerMessageId = resp?.messageId || null;
    } catch (edgeErr) {
      logger.warn('Bulk: edge function failed, using fallback', { siteId, recipient, error: edgeErr.message });
      try {
        deliveryChannel = 'api-fallback';
        const fallbackResp = await sendEmail({
          to: [recipient],
          subject,
          text: trackedText,
          html: trackedHtml,
        });
        providerMessageId = fallbackResp?.id || null;
      } catch (fallbackErr) {
        await updateSiteContactHistoryEntry(contactEntry.id, {
          delivery_status: 'failed',
          delivery_channel: deliveryChannel,
          follow_up_status: 'canceled',
        });
        logger.error('Bulk: email send failed', { siteId, recipient, error: fallbackErr.message });
        continue;
      }
    }

    await updateSiteContactHistoryEntry(contactEntry.id, {
      delivery_channel: deliveryChannel,
      provider_message_id: providerMessageId,
    });

    // Schedule follow-up automation (72h no-open rule)
    try {
      await scheduleFollowUp({
        contactHistoryId: contactEntry.id,
        rule: 'no_open',
        delayMs: 72 * 60 * 60 * 1000,
      });
      await updateSiteContactHistoryEntry(contactEntry.id, {
        follow_up_status: 'scheduled',
        follow_up_rule: 'no_open',
        follow_up_scheduled_for: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      });
    } catch {
      // follow-ups are best-effort
    }

    sentRecipients.push(recipient);
    logger.info('Bulk: email sent', { siteId, recipient });
  }

  // Update site contacted_at
  await supabase
    .from('sites')
    .update({ last_contacted_at: new Date().toISOString() })
    .eq('id', site.id);

  return { siteId, scanned: true, emailed: sentRecipients.length > 0, recipients: sentRecipients };
}

// ── Worker ─────────────────────────────────────────────────────────

function initBulkWorker() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || bulkWorker) return bulkWorker;

  const connection = parseRedisUrl(redisUrl);

  bulkWorker = new Worker(
    BULK_QUEUE_NAME,
    async (job) => {
      // ── Daily trigger: pick next N pending sites and enqueue them ──
      if (job.name === 'daily-trigger') {
        logger.info('Bulk: daily trigger fired, picking next sites');
        const { data: pending, error } = await supabase
          .from('sites')
          .select('id')
          .eq('import_source', 'excel_bulk_import')
          .or('last_contacted_at.is.null,last_contacted_at.lt.' + new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .not('owner_email', 'is', null)
          .order('created_at', { ascending: true })
          .limit(DAILY_LIMIT);

        if (error) {
          logger.error('Bulk trigger: failed to fetch pending sites', { error: error.message });
          return { enqueued: 0 };
        }

        let enqueued = 0;
        for (const site of (pending || [])) {
          try {
            await enqueueBulkSite({ siteId: site.id, batchId: null });
            enqueued++;
          } catch (err) {
            logger.warn('Bulk trigger: could not enqueue site', { siteId: site.id, error: err.message });
          }
        }
        logger.info('Bulk trigger: enqueued sites', { enqueued });
        return { enqueued };
      }

      // ── Process a single site ──────────────────────────────────────
      const { siteId, batchId } = job.data;
      logger.info('Bulk: processing site', { siteId });
      return processOneSite(siteId, batchId);
    },
    {
      connection,
      concurrency: 1, // scan one site at a time to avoid hammering Puppeteer
      limiter: { max: 2, duration: 24 * 60 * 60 * 1000 }, // at most 2 process-site jobs per 24h
    }
  );

  bulkWorker.on('completed', (job, result) => {
    logger.info('Bulk job completed', { jobId: job.id, result });
  });

  bulkWorker.on('failed', (job, err) => {
    logger.error('Bulk job failed', { jobId: job?.id, error: err?.message });
  });

  logger.info('Bulk outreach worker initialised');
  return bulkWorker;
}

module.exports = {
  initBulkQueue,
  initBulkWorker,
  getBulkQueue,
  enqueueBulkSite,
  scheduleDailyTrigger,
};
