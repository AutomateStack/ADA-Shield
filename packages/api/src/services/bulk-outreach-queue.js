/**
 * Bulk Outreach Queue
 *
 * Processes sites imported from Excel.  For each site it:
 *   1. Scans the site (Puppeteer + axe-core via scanner package).
 *   2. Saves the scan result.
 *   3. Sends a tracked outreach email.
 *   4. Records contact history with tracking tokens.
 *
 * Daily cap: admin-configurable sites/day, enforced by the
 * 'daily-bulk-trigger' repeatable job that enqueues up to the saved
 * pending-site limit each morning.
 *
 * All operations are read-only wrappers around existing helpers to avoid
 * duplicating business logic.
 */

const crypto = require('crypto');
const { Queue, Worker } = require('bullmq');
const { scanPage, calculateRiskScore } = require('@ada-shield/scanner');
const { saveScanResult } = require('../db/scans');
const { supabase } = require('../db/supabase');
const {
  getSiteById,
  getLatestSiteScanSummary,
  markSiteAsContacted,
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
const { isEmailSuppressed } = require('../db/suppressions');
const { logger } = require('../utils/logger');

const BULK_QUEUE_NAME = 'bulk-outreach';
const DEFAULT_DAILY_LIMIT = 2;
const SETTINGS_TABLE = 'bulk_import_settings';
const SETTINGS_ROW_ID = 'global';

// Minimum days between any two outreach emails to the same site.
// Prevents same-day duplicates and ensures respectful send cadence.
// Override with MIN_DAYS_BETWEEN_OUTREACH env var (must be >= 1).
const MIN_DAYS_BETWEEN_OUTREACH = Math.max(
  1,
  parseInt(process.env.MIN_DAYS_BETWEEN_OUTREACH || '4', 10) || 4
);

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

function isMissingSettingsSchemaError(error) {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || code === '42703' || message.includes(SETTINGS_TABLE);
}

function sanitizeDailyLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_DAILY_LIMIT;
  return Math.min(Math.max(parsed, 1), 100);
}

async function getBulkDailyLimit() {
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select('daily_limit')
    .eq('id', SETTINGS_ROW_ID)
    .maybeSingle();

  if (error) {
    if (isMissingSettingsSchemaError(error)) {
      logger.warn('Bulk settings table missing, using default daily limit', { defaultDailyLimit: DEFAULT_DAILY_LIMIT });
      return DEFAULT_DAILY_LIMIT;
    }
    throw error;
  }

  return sanitizeDailyLimit(data?.daily_limit);
}

async function setBulkDailyLimit(dailyLimit) {
  const nextLimit = sanitizeDailyLimit(dailyLimit);
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert(
      {
        id: SETTINGS_ROW_ID,
        daily_limit: nextLimit,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('daily_limit')
    .single();

  if (error) {
    if (isMissingSettingsSchemaError(error)) {
      const migrationError = new Error(
        'Bulk import settings migration is not applied yet. Run supabase/migrations/014_bulk_import_settings.sql.'
      );
      migrationError.statusCode = 500;
      throw migrationError;
    }
    throw error;
  }

  return sanitizeDailyLimit(data?.daily_limit);
}

async function enqueuePendingBulkSites(limit) {
  const safeLimit = sanitizeDailyLimit(limit);
  // Only pick sites not contacted within the last MIN_DAYS_BETWEEN_OUTREACH days.
  // This is the primary query-level guard; processOneSite adds a second runtime check.
  const threshold = new Date(Date.now() - MIN_DAYS_BETWEEN_OUTREACH * 24 * 60 * 60 * 1000).toISOString();

  const { data: pending, error } = await supabase
    .from('sites')
    .select('id')
    .eq('import_source', 'excel_bulk_import')
    .eq('outreach_paused', false)
    .or(`last_contacted_at.is.null,last_contacted_at.lt.${threshold}`)
    .not('owner_email', 'is', null)
    .order('created_at', { ascending: true })
    .limit(safeLimit);

  if (error) {
    logger.error('Bulk enqueue: failed to fetch pending sites', { error: error.message });
    return { enqueued: 0, requestedLimit: safeLimit };
  }

  let enqueued = 0;
  for (const site of pending || []) {
    try {
      await enqueueBulkSite({ siteId: site.id, batchId: null });
      enqueued += 1;
    } catch (err) {
      logger.warn('Bulk enqueue: could not enqueue site', { siteId: site.id, error: err.message });
    }
  }

  return { enqueued, requestedLimit: safeLimit };
}

// ── Queue init ─────────────────────────────────────────────────────

function initBulkQueue() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || bulkQueue) return bulkQueue;

  const connection = parseRedisUrl(redisUrl);
  bulkQueue = new Queue(BULK_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 1,
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
  // Use a date-scoped job ID so the same site cannot be enqueued more than once
  // per calendar day. adhoc-${Date.now()} would create a unique ID every call
  // and allow the daily trigger to double-queue a site after a server restart.
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const batchScope = batchId || `daily-${today}`;
  const job = await queue.add('process-site', { siteId, batchId }, {
    jobId: `bulk-${siteId}-${batchScope}`,
  });
  logger.info('Bulk site enqueued', { jobId: job.id, siteId });
  return job;
}

// ── Daily trigger job ──────────────────────────────────────────────

/**
 * Registers a repeatable cron job.
 * Schedule is controlled by the BULK_OUTREACH_CRON env variable (standard cron syntax).
 * Defaults to '0 9 * * *' (09:00 UTC daily) when the variable is not set.
 *
 * Common examples:
 *   '0 9 * * *'      — every day at 09:00 UTC
 *   '0 14 * * *'     — every day at 14:00 UTC
 *   '0 9 * * 1-5'    — weekdays only at 09:00 UTC
 *   '0 9,14 * * *'   — twice a day at 09:00 and 14:00 UTC
 */
async function scheduleDailyTrigger() {
  const queue = getBulkQueue();
  if (!queue) return;

  const cronExpression = (process.env.BULK_OUTREACH_CRON || '0 9 * * *').trim();

  // Remove ALL existing 'daily-trigger' repeatable jobs regardless of cron expression
  // so a changed schedule takes effect immediately on redeploy instead of running both.
  try {
    const repeatables = await queue.getRepeatableJobs();
    await Promise.all(
      repeatables
        .filter((j) => j.name === 'daily-trigger')
        .map((j) => queue.removeRepeatableByKey(j.key))
    );
  } catch {
    // Ignore — no jobs may exist yet on first run
  }

  await queue.add(
    'daily-trigger',
    {},
    {
      repeat: { cron: cronExpression },
      jobId: 'bulk-daily-trigger',
    }
  );
  logger.info('Daily bulk trigger scheduled', { cron: cronExpression });
}

// ── Core processing logic ──────────────────────────────────────────

async function processOneSite(siteId, batchId) {
  const site = await getSiteById(siteId);
  if (!site) throw new Error(`Site ${siteId} not found`);

  // Runtime cooldown guard — second layer of protection in case the same site
  // slips through enqueuePendingBulkSites (e.g. job queued before last_contacted_at
  // was written, or the server restarted mid-batch and re-enqueued).
  if (site.last_contacted_at) {
    const daysSince = (Date.now() - new Date(site.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < MIN_DAYS_BETWEEN_OUTREACH) {
      logger.warn('Bulk: skipping site — contacted too recently', {
        siteId,
        lastContactedAt: site.last_contacted_at,
        daysSince: daysSince.toFixed(1),
        minDays: MIN_DAYS_BETWEEN_OUTREACH,
      });
      return { siteId, skipped: true, reason: 'contacted_too_recently', daysSince: parseFloat(daysSince.toFixed(1)) };
    }
  }

  // IMPORTANT: stamp last_contacted_at NOW — before scan or email — so that any
  // BullMQ retry (e.g. if markSiteAsContacted failed after emails were already
  // sent) is blocked by the cooldown check above and cannot send duplicate emails.
  await markSiteAsContacted(siteId);

  // 1. Scan
  logger.info('Bulk: scanning site', { siteId, url: site.url });
  let scanData;
  try {
    scanData = await scanPage(site.url, { pageLimit: 1 });
  } catch (scanErr) {
    throw new Error(`Scan failed for ${site.url}: ${scanErr.message}`);
  }

  const riskResult = calculateRiskScore(scanData.violations || []);
  const riskScore = riskResult.score;
  const industry = detectIndustry(site.url, site.name);
  const industryCtx = getIndustryContext(industry);

  // 2. Save scan result
  const publicToken = crypto.randomUUID();
  const scanRecord = await saveScanResult({
    siteId: site.id,
    userId: null,
    url: scanData.url || site.url,
    riskScore,
    totalViolations: scanData.totalViolations || 0,
    criticalCount: scanData.criticalCount || 0,
    seriousCount: scanData.seriousCount || 0,
    moderateCount: scanData.moderateCount || 0,
    minorCount: scanData.minorCount || 0,
    violations: scanData.violations || [],
    passedRules: scanData.passedRules || 0,
    incompleteRules: scanData.incompleteRules || 0,
    scanDurationMs: scanData.scanDurationMs || 0,
    publicToken,
  });

  await supabase
    .from('sites')
    .update({ last_scanned_at: new Date().toISOString() })
    .eq('id', site.id);

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
  const industryRiskContext = industryCtx?.riskContext || '';
  const industryActionContext = industryCtx?.callSignal || '';
  const message = `Hello,

I scanned ${siteName} and found ${violationCount} accessibility issue${violationCount !== 1 ? 's' : ''} that could expose you to ADA lawsuits.

Your risk score: ${riskScore}/100${riskScore >= 70 ? ' — HIGH RISK' : riskScore >= 40 ? ' — MEDIUM RISK' : ' — LOW RISK'}.

${industryRiskContext ? `${industryRiskContext}\n\n` : ''}${industryActionContext ? `${industryActionContext}\n\n` : ''}View your full free report with specific code fixes below.
Here is your generated report: ${reportUrl}

Thank you,
Thirmal
ADA Shield

`;

  const sentRecipients = [];

  for (let idx = 0; idx < recipients.length; idx++) {
    const recipient = recipients[idx];

    const suppressed = await isEmailSuppressed(recipient);
    if (suppressed) {
      logger.info('Bulk: skipping suppressed recipient', { siteId, recipient });
      continue;
    }

    // Final dedup guard: check contact history for a recent sent email to this
    // recipient. Catches the case where last_contacted_at was just stamped but a
    // previous attempt already sent the email before failing on something else.
    const cooldownThreshold = new Date(Date.now() - MIN_DAYS_BETWEEN_OUTREACH * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentEntry } = await supabase
      .from('site_contact_history')
      .select('id')
      .eq('site_id', siteId)
      .eq('recipient_email', recipient)
      .eq('delivery_status', 'sent')
      .gt('created_at', cooldownThreshold)
      .limit(1)
      .maybeSingle();
    if (recentEntry) {
      logger.warn('Bulk: skipping recipient — already contacted within cooldown window', { siteId, recipient });
      continue;
    }

    const trackingToken = crypto.randomUUID();
    const trackingUrls = buildTrackingUrls(trackingToken, reportUrl);
    const trackedText = injectTrackedLink(
      message,
      `Here is your generated report: ${trackingUrls.reportUrl}`
    );
    const trackedHtml = buildTrackedEmailHtml({
      subject,
      message,
      siteName,
      siteUrl: site.url,
      trackedReportUrl: trackingUrls.trackedReportUrl,
      trackingPixelUrl: trackingUrls.trackingPixelUrl,
      selfScanUrl: buildReportUrl(null),
      unsubscribeUrl: trackingUrls.unsubscribeUrl,
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

    let deliveryChannel = 'smtp';
    let providerMessageId = null;

    try {
      const emailInfo = await sendEmail({
        to: [recipient],
        subject,
        text: trackedText,
        html: trackedHtml,
      });
      if (!emailInfo) {
        throw new Error('SMTP not configured — set SMTP_USER and SMTP_PASS in environment variables');
      }
      providerMessageId = emailInfo.messageId || null;
    } catch (sendErr) {
      logger.error('Bulk: email send failed', { siteId, recipient, error: sendErr.message });
      await updateSiteContactHistoryEntry(contactEntry.id, {
        delivery_status: 'failed',
        delivery_channel: deliveryChannel,
        follow_up_status: 'canceled',
      });
      continue;
    }

    await updateSiteContactHistoryEntry(contactEntry.id, {
      delivery_channel: deliveryChannel,
      provider_message_id: providerMessageId,
    });

    // Schedule follow-up check at 1 week — if not opened, send follow-up then
    try {
      await scheduleFollowUp({
        contactHistoryId: contactEntry.id,
        rule: 'no_open',
        delayMs: 7 * 24 * 60 * 60 * 1000,
      });
      await updateSiteContactHistoryEntry(contactEntry.id, {
        follow_up_status: 'scheduled',
        follow_up_rule: 'no_open',
        follow_up_scheduled_for: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch {
      // follow-ups are best-effort
    }

    sentRecipients.push(recipient);
    logger.info('Bulk: email sent', { siteId, recipient });
  }

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
        const dailyLimit = await getBulkDailyLimit();
        logger.info('Bulk: daily trigger fired', { dailyLimit });
        const outcome = await enqueuePendingBulkSites(dailyLimit);
        logger.info('Bulk trigger: enqueued sites', outcome);
        return outcome;
      }

      // ── Process a single site ──────────────────────────────────────
      const { siteId, batchId } = job.data;
      logger.info('Bulk: processing site', { siteId });
      return processOneSite(siteId, batchId);
    },
    {
      connection,
      concurrency: 1, // scan one site at a time to avoid hammering Puppeteer
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
  enqueuePendingBulkSites,
  getBulkDailyLimit,
  setBulkDailyLimit,
  scheduleDailyTrigger,
};
