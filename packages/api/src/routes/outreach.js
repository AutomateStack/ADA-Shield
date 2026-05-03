const { Router } = require('express');
const {
  createSiteContactEvent,
  getSiteContactHistoryEntryByTrackingToken,
  recordSiteContactEngagement,
  updateSiteContactHistoryEntry,
} = require('../db/admin');
const { cancelFollowUp, scheduleFollowUp } = require('../services/outreach-queue');
const { getDashboardBaseUrl, hashIpAddress } = require('../services/outreach-tracking');
const { addEmailSuppression } = require('../db/suppressions');
const { logger } = require('../utils/logger');

const router = Router();

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64'
);

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || '';
}

async function scheduleTrackedFollowUp(contact, rule, delayMs) {
  const scheduled = await scheduleFollowUp({
    contactHistoryId: contact.id,
    rule,
    delayMs,
  });

  if (!scheduled) return null;

  await updateSiteContactHistoryEntry(contact.id, {
    follow_up_status: 'scheduled',
    follow_up_rule: rule,
    follow_up_scheduled_for: scheduled.scheduledFor,
  });

  await createSiteContactEvent({
    siteId: contact.site_id,
    contactHistoryId: contact.id,
    eventType: 'follow_up_scheduled',
    metadata: {
      rule,
      scheduledFor: scheduled.scheduledFor,
    },
  });

  return scheduled;
}

router.get('/open/:trackingToken.gif', async (req, res) => {
  try {
    const trackingToken = req.params.trackingToken;
    const existing = await getSiteContactHistoryEntryByTrackingToken(trackingToken);

    if (existing) {
      const updated = await recordSiteContactEngagement({
        trackingToken,
        eventType: 'open',
        userAgent: req.get('user-agent') || null,
        ipAddressHash: hashIpAddress(getClientIp(req)),
      });

      if (updated) {
        const newOpensCount = Number(updated.opens_count || 0);

        if (newOpensCount === 1) {
          // First open: cancel the 1-week no-open job, schedule 2-day follow-up
          await cancelFollowUp(updated.id, 'no_open').catch(() => false);
          await scheduleTrackedFollowUp(updated, 'opened_no_click', 2 * 24 * 60 * 60 * 1000);
        } else if (newOpensCount === 3) {
          // Fire re-engagement follow-up only on the 3rd open (once per contact).
          // Triggering on every 3rd open (3,6,9...) caused repeated emails because
          // email clients pre-fetch tracking pixels multiple times per session.
          await scheduleTrackedFollowUp(updated, 'opened_repeat', 30 * 60 * 1000);
        }
      }
    }
  } catch (error) {
    logger.warn('Failed to record outreach open event', { error: error.message, trackingToken: req.params.trackingToken });
  }

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Content-Length', TRANSPARENT_GIF.length);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.status(200).end(TRANSPARENT_GIF);
});

router.get('/click/:trackingToken', async (req, res) => {
  const fallbackUrl = getDashboardBaseUrl();

  try {
    const trackingToken = req.params.trackingToken;
    const existing = await getSiteContactHistoryEntryByTrackingToken(trackingToken);

    if (!existing) {
      return res.redirect(302, fallbackUrl);
    }

    const updated = await recordSiteContactEngagement({
      trackingToken,
      eventType: 'click',
      url: existing.report_url || fallbackUrl,
      userAgent: req.get('user-agent') || null,
      ipAddressHash: hashIpAddress(getClientIp(req)),
    });

    if (updated && Number(existing.clicks_count || 0) === 0) {
      await cancelFollowUp(updated.id, 'no_open').catch(() => false);
      await cancelFollowUp(updated.id, 'opened_no_click').catch(() => false);
      await scheduleTrackedFollowUp(updated, 'clicked_report', 48 * 60 * 60 * 1000);
    }

    return res.redirect(302, existing.report_url || fallbackUrl);
  } catch (error) {
    logger.warn('Failed to record outreach click event', { error: error.message, trackingToken: req.params.trackingToken });
    return res.redirect(302, fallbackUrl);
  }
});

router.get('/unsubscribe/:trackingToken', async (req, res) => {
  const { trackingToken } = req.params;
  const dashboardUrl = getDashboardBaseUrl();

  try {
    const contact = await getSiteContactHistoryEntryByTrackingToken(trackingToken);

    if (contact && !contact.unsubscribed_at) {
      await addEmailSuppression({
        email: contact.recipient_email,
        reason: 'unsubscribe',
        sourceContactHistoryId: contact.id,
        metadata: { tracking_token: trackingToken },
      });
      await updateSiteContactHistoryEntry(contact.id, {
        unsubscribed_at: new Date().toISOString(),
        follow_up_status: 'canceled',
      });
      await createSiteContactEvent({
        siteId: contact.site_id,
        contactHistoryId: contact.id,
        eventType: 'unsubscribe',
        metadata: { tracking_token: trackingToken },
      });
      logger.info('Outreach unsubscribe processed', { recipient: contact.recipient_email });
    }
  } catch (error) {
    logger.warn('Failed to process unsubscribe', { trackingToken, error: error.message });
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed - ADA Shield</title>
  <style>
    body { margin: 0; padding: 40px 20px; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
    .card { background: #1e293b; border-radius: 12px; padding: 40px; max-width: 440px; width: 100%; text-align: center; border: 1px solid rgba(255,255,255,0.08); }
    h1 { color: #fff; font-size: 22px; margin: 0 0 12px; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0; }
    a { color: #818cf8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:40px;margin-bottom:16px;">✓</div>
    <h1>You've been unsubscribed</h1>
    <p>You won't receive any more outreach emails from ADA Shield.<br><br>
    If this was a mistake, <a href="${dashboardUrl}">visit ADA Shield</a>.</p>
  </div>
</body>
</html>`);
});

module.exports = {
  outreachRoutes: router,
};