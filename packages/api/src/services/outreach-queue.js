const crypto = require('crypto');
const { Queue, Worker } = require('bullmq');
const {
  createSiteContactEvent,
  createSiteContactHistoryEntry,
  getSiteById,
  getLatestSiteScanSummary,
  getSiteContactHistoryEntryById,
  updateSiteContactHistoryEntry,
} = require('../db/admin');
const { sendEmail } = require('./email');
const {
  buildFollowUpContent,
  buildReportUrl,
  buildTrackedEmailHtml,
  buildTrackingUrls,
  injectTrackedLink,
} = require('./outreach-tracking');
const { isEmailSuppressed } = require('../db/suppressions');
const { logger } = require('../utils/logger');

const QUEUE_NAME = 'outreach-followups';

let outreachQueue = null;
let outreachWorker = null;

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

function getOutreachQueue() {
  return outreachQueue;
}

function initOutreachQueue() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || outreachQueue) return outreachQueue;

  outreachQueue = new Queue(QUEUE_NAME, {
    connection: parseRedisUrl(redisUrl),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

  logger.info('Outreach follow-up queue initialised');
  return outreachQueue;
}

async function scheduleFollowUp({ contactHistoryId, rule, delayMs, jobIdSuffix = '' }) {
  const queue = getOutreachQueue();
  if (!queue) return null;

  const safeDelay = Math.max(0, Number(delayMs || 0));
  const jobId = `outreach-followup:${contactHistoryId}:${rule}${jobIdSuffix ? `:${jobIdSuffix}` : ''}`;
  const scheduledFor = new Date(Date.now() + safeDelay).toISOString();

  await queue.add(
    'send-followup',
    {
      contactHistoryId,
      rule,
      scheduledFor,
    },
    {
      jobId,
      delay: safeDelay,
    }
  );

  return { jobId, scheduledFor };
}

async function cancelFollowUp(contactHistoryId, rule) {
  const queue = getOutreachQueue();
  if (!queue) return false;

  const job = await queue.getJob(`outreach-followup:${contactHistoryId}:${rule}`);
  if (!job) return false;
  await job.remove();
  return true;
}

function extractFirstName(ownerName) {
  if (!ownerName) return 'there';
  const first = String(ownerName).trim().split(/\s+/)[0];
  return first || 'there';
}

function canSendFollowUp(contact, rule) {
  if (!contact || !contact.automation_enabled || contact.delivery_status !== 'sent') return false;

  // Never send to contacts who opted out, bounced, or complained
  if (contact.unsubscribed_at || contact.bounced_at || contact.complained_at) return false;

  // Don't follow up once they've replied — they're already engaged
  if (contact.replied_at) return false;

  // Hard cap: max 6 total follow-ups per contact to prevent spam
  if (Number(contact.follow_up_attempts || 0) >= 6) return false;

  if (rule === 'no_open') {
    // Only send if they have never opened
    return Number(contact.opens_count || 0) === 0;
  }

  if (rule === 'opened_no_click') {
    // Opened but not yet clicked
    return Number(contact.opens_count || 0) > 0 && Number(contact.clicks_count || 0) === 0;
  }

  if (rule === 'opened_repeat') {
    // Triggered at every 3rd open — just cap-check, scheduling already validated the timing
    return true;
  }

  if (rule === 'clicked_report') {
    return Number(contact.clicks_count || 0) > 0;
  }

  return false;
}

async function markFollowUpSkipped(contact, rule, reason) {
  await updateSiteContactHistoryEntry(contact.id, {
    follow_up_status: 'skipped',
    follow_up_rule: rule,
  });

  await createSiteContactEvent({
    siteId: contact.site_id,
    contactHistoryId: contact.id,
    eventType: 'follow_up_skipped',
    metadata: { rule, reason },
  });
}

function initOutreachWorker() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || outreachWorker) return outreachWorker;

  outreachWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { contactHistoryId, rule } = job.data;
      const contact = await getSiteContactHistoryEntryById(contactHistoryId);

      if (!contact) {
        logger.warn('Skipping follow-up because contact history record was not found', { contactHistoryId, rule });
        return { status: 'skipped', reason: 'contact_not_found' };
      }

      if (!canSendFollowUp(contact, rule)) {
        await markFollowUpSkipped(contact, rule, 'rule_conditions_not_met');
        return { status: 'skipped', reason: 'rule_conditions_not_met' };
      }

      // Second-layer suppression check against the live suppressions table
      const suppressed = await isEmailSuppressed(contact.recipient_email);
      if (suppressed) {
        logger.info('Follow-up skipped — recipient is suppressed', { contactHistoryId, rule, recipient: contact.recipient_email });
        await markFollowUpSkipped(contact, rule, 'email_suppressed');
        return { status: 'skipped', reason: 'email_suppressed' };
      }

      const [site, latestScan] = await Promise.all([
        getSiteById(contact.site_id),
        getLatestSiteScanSummary(contact.site_id),
      ]);

      const reportUrl = buildReportUrl(latestScan?.public_token || null);
      const followUp = buildFollowUpContent({
        rule,
        firstName: extractFirstName(site?.owner_name),
        siteName: site?.name || site?.url || 'your website',
        reportUrl,
        riskScore: latestScan?.risk_score,
      });

      const trackingToken = crypto.randomUUID();
      const trackingUrls = buildTrackingUrls(trackingToken, reportUrl);
      const followUpText = injectTrackedLink(
        followUp.message,
        `Here is your generated report: ${trackingUrls.reportUrl}`
      );
      const followUpEntry = await createSiteContactHistoryEntry({
        siteId: contact.site_id,
        recipientEmail: contact.recipient_email,
        subject: followUp.subject,
        message: followUpText,
        templateStyle: contact.template_style,
        deliveryChannel: 'api-fallback',
        deliveryStatus: 'sent',
        sendBatchId: contact.send_batch_id || crypto.randomUUID(),
        parentContactHistoryId: contact.id,
        scanId: latestScan?.id || null,
        reportUrl: trackingUrls.reportUrl,
        trackedReportUrl: trackingUrls.trackedReportUrl,
        trackingPixelUrl: trackingUrls.trackingPixelUrl,
        automationEnabled: false,
        trackingToken,
      });

      const html = buildTrackedEmailHtml({
        subject: followUp.subject,
        message: followUp.message,
        siteName: site?.name || site?.url || 'your website',
        siteUrl: site?.url || '',
        trackedReportUrl: trackingUrls.trackedReportUrl,
        trackingPixelUrl: trackingUrls.trackingPixelUrl,
        selfScanUrl: buildReportUrl(null),
        unsubscribeUrl: trackingUrls.unsubscribeUrl,
      });

      const response = await sendEmail({
        to: [contact.recipient_email],
        subject: followUp.subject,
        text: followUpText,
        html,
      });

      if (!response) {
        throw new Error('SMTP not configured — set SMTP_USER and SMTP_PASS in environment variables');
      }

      await updateSiteContactHistoryEntry(followUpEntry.id, {
        provider_message_id: response?.messageId || null,
      });

      await createSiteContactEvent({
        siteId: contact.site_id,
        contactHistoryId: contact.id,
        eventType: 'follow_up_sent',
        metadata: { rule, followUpContactHistoryId: followUpEntry.id },
      });

      await createSiteContactEvent({
        siteId: contact.site_id,
        contactHistoryId: followUpEntry.id,
        eventType: 'sent',
        metadata: { automated: true, rule, parentContactHistoryId: contact.id },
      });

      const newAttempts = Number(contact.follow_up_attempts || 0) + 1;

      await updateSiteContactHistoryEntry(contact.id, {
        follow_up_status: 'sent',
        follow_up_rule: rule,
        follow_up_sent_at: new Date().toISOString(),
        follow_up_attempts: newAttempts,
      });

      // If still not opened after this no_open follow-up, reschedule another 1-week check
      // (max 4 no-open follow-ups = 4 weeks of attempts before stopping)
      if (rule === 'no_open' && Number(contact.opens_count || 0) === 0 && newAttempts < 4) {
        try {
          await scheduleFollowUp({
            contactHistoryId: contact.id,
            rule: 'no_open',
            delayMs: 7 * 24 * 60 * 60 * 1000,
            jobIdSuffix: String(newAttempts),
          });
          await updateSiteContactHistoryEntry(contact.id, {
            follow_up_status: 'scheduled',
            follow_up_scheduled_for: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });
          logger.info('Rescheduled next no-open follow-up', { contactHistoryId: contact.id, attempt: newAttempts });
        } catch (err) {
          logger.warn('Failed to reschedule no-open follow-up', { contactHistoryId: contact.id, error: err.message });
        }
      }

      return {
        status: 'sent',
        followUpContactHistoryId: followUpEntry.id,
        rule,
      };
    },
    {
      connection: parseRedisUrl(redisUrl),
      concurrency: 2,
      limiter: { max: 10, duration: 60000 },
    }
  );

  outreachWorker.on('failed', (job, err) => {
    logger.error('Outreach follow-up job failed', { jobId: job?.id, error: err.message });
  });

  outreachWorker.on('error', (err) => {
    logger.error('Outreach follow-up worker error', { error: err.message });
  });

  logger.info('Outreach follow-up worker initialised');
  return outreachWorker;
}

module.exports = {
  initOutreachQueue,
  getOutreachQueue,
  scheduleFollowUp,
  cancelFollowUp,
  initOutreachWorker,
};