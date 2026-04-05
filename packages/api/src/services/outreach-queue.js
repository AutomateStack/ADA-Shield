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

async function scheduleFollowUp({ contactHistoryId, rule, delayMs }) {
  const queue = getOutreachQueue();
  if (!queue) return null;

  const safeDelay = Math.max(0, Number(delayMs || 0));
  const jobId = `outreach-followup:${contactHistoryId}:${rule}`;
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
  if (Number(contact.follow_up_attempts || 0) >= 1) return false;

  if (rule === 'no_open') {
    return Number(contact.opens_count || 0) === 0;
  }

  if (rule === 'opened_no_click') {
    return Number(contact.opens_count || 0) > 0 && Number(contact.clicks_count || 0) === 0;
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
      const followUpEntry = await createSiteContactHistoryEntry({
        siteId: contact.site_id,
        recipientEmail: contact.recipient_email,
        subject: followUp.subject,
        message: injectTrackedLink(followUp.message, trackingUrls.trackedReportUrl),
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
      });

      const response = await sendEmail({
        to: [contact.recipient_email],
        subject: followUp.subject,
        text: injectTrackedLink(followUp.message, trackingUrls.trackedReportUrl),
        html,
      });

      await updateSiteContactHistoryEntry(followUpEntry.id, {
        provider_message_id: response?.id || null,
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

      await updateSiteContactHistoryEntry(contact.id, {
        follow_up_status: 'sent',
        follow_up_rule: rule,
        follow_up_sent_at: new Date().toISOString(),
        follow_up_attempts: Number(contact.follow_up_attempts || 0) + 1,
      });

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