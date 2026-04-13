const { Router } = require('express');
const {
  createSiteContactEvent,
  getSiteContactHistoryEntryByTrackingToken,
  recordSiteContactEngagement,
  updateSiteContactHistoryEntry,
} = require('../db/admin');
const { cancelFollowUp, scheduleFollowUp } = require('../services/outreach-queue');
const { getDashboardBaseUrl, hashIpAddress } = require('../services/outreach-tracking');
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

      if (updated && Number(existing.opens_count || 0) === 0) {
        await cancelFollowUp(updated.id, 'no_open').catch(() => false);
        await scheduleTrackedFollowUp(updated, 'opened_no_click', 24 * 60 * 60 * 1000);
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

module.exports = {
  outreachRoutes: router,
};