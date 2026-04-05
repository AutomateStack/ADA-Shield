const crypto = require('crypto');

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    return parsed.origin.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function isLocalOrigin(origin) {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function pickBaseUrl({ override, envKeys, fallback }) {
  const normalizedOverride = normalizeBaseUrl(override);
  if (normalizedOverride) return normalizedOverride;

  const candidates = envKeys
    .map((key) => normalizeBaseUrl(process.env[key]))
    .filter(Boolean);

  // Prefer a non-local origin if available (prevents localhost links in emails).
  const nonLocal = candidates.find((origin) => !isLocalOrigin(origin));
  if (nonLocal) return nonLocal;

  const first = candidates[0];
  if (first) return first;

  return normalizeBaseUrl(fallback);
}

function getApiBaseUrl(options = {}) {
  return pickBaseUrl({
    override: options.apiBaseUrl,
    envKeys: ['PUBLIC_API_URL', 'API_URL', 'NEXT_PUBLIC_API_URL'],
    fallback: 'http://localhost:4000',
  });
}

function getDashboardBaseUrl(options = {}) {
  return pickBaseUrl({
    override: options.dashboardBaseUrl,
    envKeys: ['PUBLIC_DASHBOARD_URL', 'DASHBOARD_URL', 'NEXT_PUBLIC_DASHBOARD_URL'],
    fallback: 'http://localhost:3000',
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function buildReportUrl(publicToken, options = {}) {
  const dashboardBaseUrl = getDashboardBaseUrl(options);
  if (!publicToken) {
    return dashboardBaseUrl;
  }

  return `${dashboardBaseUrl}/report/${publicToken}`;
}

function buildTrackingUrls(trackingToken, reportUrl, options = {}) {
  const apiBaseUrl = getApiBaseUrl(options);

  return {
    reportUrl,
    trackedReportUrl: `${apiBaseUrl}/api/outreach/click/${trackingToken}`,
    trackingPixelUrl: `${apiBaseUrl}/api/outreach/open/${trackingToken}.gif`,
  };
}

function injectTrackedLink(message, trackedReportUrl) {
  const normalized = String(message || '').trim();
  if (!normalized) return trackedReportUrl;

  const urlMatches = normalized.match(/https?:\/\/[^\s]+/gi);
  if (urlMatches && urlMatches.length > 0) {
    return normalized.replace(urlMatches[0], trackedReportUrl);
  }

  return `${normalized}\n\n${trackedReportUrl}`;
}

function renderHtmlWithLinks(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/(https?:\/\/[^\s<]+)/gi, (url) => {
    return `<a href="${url}" style="color: #2563eb; text-decoration: underline;">${url}</a>`;
  }).replace(/\n/g, '<br />');
}

function renderTrackedMessageHtml(message, trackedReportUrl, selfScanUrl) {
  const normalized = String(message || '').trim();
  const reportToken = '__ADA_REPORT_LINK__';
  const hasExistingUrl = /https?:\/\/[^\s]+/i.test(normalized);
  const textWithToken = hasExistingUrl
    ? normalized.replace(/https?:\/\/[^\s]+/i, reportToken)
    : `${normalized}\n\n${reportToken}`;

  const reportLink = `<a href="${escapeHtml(trackedReportUrl)}" style="color: #2563eb; font-weight: bold; text-decoration: underline;">View your free accessibility report &rarr;</a>`;
  const selfScanLink = `<a href="${escapeHtml(selfScanUrl)}" style="color: #0f766e; font-weight: 600; text-decoration: underline;">You can also run your own free scan here</a>`;
  const ctaBlock = `${reportLink}<br /><span style="display:inline-block;margin:8px 0 4px;color:#64748b;font-size:12px;">or</span><br />${selfScanLink}`;

  return renderHtmlWithLinks(textWithToken).replace(reportToken, ctaBlock);
}

function buildTrackedEmailHtml({ subject, message, siteName, siteUrl, trackedReportUrl, trackingPixelUrl, selfScanUrl }) {
  const scanUrl = selfScanUrl || getDashboardBaseUrl();

  const safeSubject = escapeHtml(subject);
  const safeSiteName = escapeHtml(siteName || 'your website');
  const safeSiteUrl = escapeHtml(siteUrl || '');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeSubject}</title>
  <style>
    body { margin: 0; padding: 24px; background: #f8fafc; font-family: Arial, sans-serif; color: #0f172a; }
    .card { max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 28px; }
    h1 { font-size: 20px; margin: 0 0 10px; color: #0f172a; }
    .meta { color: #64748b; font-size: 12px; margin: 0 0 18px; }
    .message { font-size: 14px; line-height: 1.7; color: #1e293b; }
    .footer { margin-top: 22px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${safeSubject}</h1>
    <div class="meta">Regarding ${safeSiteName}${safeSiteUrl ? ` (${safeSiteUrl})` : ''}</div>
    <div class="message">${renderTrackedMessageHtml(message, trackedReportUrl, scanUrl)}</div>
    <div class="footer">Sent via ADA Shield</div>
  </div>
  <img src="${trackingPixelUrl}" alt="" width="1" height="1" style="display:block;border:0;width:1px;height:1px;opacity:0;" />
</body>
</html>`;
}

function calculateLeadScore(contact) {
  const opensCount = Math.max(0, Number(contact?.opens_count || 0));
  const clicksCount = Math.max(0, Number(contact?.clicks_count || 0));
  const createdAt = contact?.created_at ? new Date(contact.created_at) : null;
  const firstOpenedAt = contact?.first_opened_at ? new Date(contact.first_opened_at) : null;
  const firstClickedAt = contact?.first_clicked_at ? new Date(contact.first_clicked_at) : null;
  const lastEngagementAt = contact?.last_engagement_at ? new Date(contact.last_engagement_at) : null;

  let score = 0;

  if (opensCount > 0) score += 20;
  if (clicksCount > 0) score += 40;
  score += Math.min(Math.max(opensCount - 1, 0), 3) * 5;
  score += Math.min(Math.max(clicksCount - 1, 0), 3) * 10;

  if (createdAt && firstOpenedAt) {
    const openDelayMinutes = Math.round((firstOpenedAt.getTime() - createdAt.getTime()) / 60000);
    if (openDelayMinutes >= 0 && openDelayMinutes <= 60) score += 15;
    else if (openDelayMinutes <= 24 * 60) score += 8;
  }

  if (createdAt && firstClickedAt) {
    const clickDelayMinutes = Math.round((firstClickedAt.getTime() - createdAt.getTime()) / 60000);
    if (clickDelayMinutes >= 0 && clickDelayMinutes <= 24 * 60) score += 15;
    else if (clickDelayMinutes <= 3 * 24 * 60) score += 8;
  }

  if (lastEngagementAt) {
    const ageHours = (Date.now() - lastEngagementAt.getTime()) / 3600000;
    if (ageHours <= 72) score += 10;
    else if (ageHours > 24 * 5) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function getLeadStatus(score) {
  if (score >= 70) return 'hot';
  if (score >= 30) return 'warm';
  return 'cold';
}

function hashIpAddress(ipAddress) {
  const normalized = String(ipAddress || '').trim();
  if (!normalized) return null;

  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function buildFollowUpContent({ rule, firstName, siteName, reportUrl, riskScore }) {
  const recipient = firstName || 'there';
  const scoreText = Number.isFinite(riskScore) ? `${riskScore}/100` : 'high';

  if (rule === 'opened_no_click') {
    return {
      subject: 'Following up on the accessibility report',
      message: `Hi ${recipient},\n\nI wanted to quickly follow up on the accessibility note I sent over for your website.\n\nIf helpful, here’s the report again with the suggested fixes:\n${reportUrl}\n\nA few small changes can usually clear the most visible issues without much engineering work.\n\nThirmal\nADA Shield`,
    };
  }

  if (rule === 'clicked_report') {
    return {
      subject: 'Want help prioritizing the fixes?',
      message: `Hi ${recipient},\n\nI noticed you checked the accessibility report for your website. The latest risk score is ${scoreText}, so I wanted to send one quick follow-up.\n\nIf you revisit the report here, the highest-priority fixes are the best place to start:\n${reportUrl}\n\nIf useful, I can also help outline which fixes to tackle first.\n\nThirmal\nADA Shield`,
    };
  }

  return {
    subject: 'Quick follow-up on your website report',
    message: `Hi ${recipient},\n\nJust following up on the accessibility report I sent for ${siteName || 'your website'}.\n\nHere’s the report again in case it helps:\n${reportUrl}\n\nThought I’d resend it in case the first note got buried.\n\nThirmal\nADA Shield`,
  };
}

module.exports = {
  buildReportUrl,
  buildTrackingUrls,
  buildTrackedEmailHtml,
  calculateLeadScore,
  getLeadStatus,
  hashIpAddress,
  injectTrackedLink,
  buildFollowUpContent,
  getApiBaseUrl,
  getDashboardBaseUrl,
};