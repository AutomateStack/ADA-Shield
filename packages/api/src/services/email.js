const { Resend } = require('resend');
const { logger } = require('../utils/logger');

/**
 * Escapes a string for safe interpolation into HTML.
 * Prevents HTML injection via user-controlled fields (e.g. siteName, siteUrl).
 * @param {any} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitizes a string for use in an email subject header.
 * Strips CR/LF characters to prevent header injection attacks and
 * truncates to a safe length.
 * @param {any} value
 * @returns {string}
 */
function sanitizeSubject(value) {
  return String(value ?? '').replace(/[\r\n\t]/g, '').slice(0, 200);
}

/**
 * Creates a Resend client. Returns null if API key is not configured.
 */
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 're_xxx') {
    return null;
  }
  return new Resend(apiKey);
}

const EMAIL_FROM = process.env.EMAIL_FROM || 'ADA Shield <onboarding@resend.dev>';
const RESEND_FALLBACK_FROM = 'ADA Shield <onboarding@resend.dev>';

/**
 * Resend requires a verified sender domain (or onboarding@resend.dev for testing).
 * If a public email domain is configured as sender, fallback to onboarding sender.
 * @param {string} from
 * @returns {string}
 */
function getVerifiedFromAddress(from) {
  const candidate = String(from || '').trim();
  const emailMatch = candidate.match(/<([^>]+)>/);
  const email = (emailMatch ? emailMatch[1] : candidate).trim().toLowerCase();
  const domain = email.includes('@') ? email.split('@')[1] : '';
  const blockedDomains = new Set([
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'icloud.com',
    'aol.com',
    'live.com',
  ]);

  if (!domain || blockedDomains.has(domain)) {
    logger.warn('EMAIL_FROM uses an unverified/public domain; falling back to Resend onboarding sender', {
      configuredFrom: candidate || null,
      fallbackFrom: RESEND_FALLBACK_FROM,
    });
    return RESEND_FALLBACK_FROM;
  }

  return candidate;
}

/**
 * Sends a scan-complete email with the risk score summary.
 */
async function sendScanCompleteEmail({ to, siteName, siteUrl, riskScore, riskLevel, totalViolations, criticalCount, seriousCount, dashboardUrl }) {
  const resend = getResendClient();
  if (!resend) {
    logger.warn('Resend not configured — skipping scan complete email');
    return null;
  }

  const riskColor = riskScore >= 70 ? '#ef4444' : riskScore >= 40 ? '#f59e0b' : '#22c55e';
  const riskEmoji = riskScore >= 70 ? '🔴' : riskScore >= 40 ? '🟡' : '🟢';
  const subjectSiteName = sanitizeSubject(siteName);
  const safeSiteName = escapeHtml(siteName);

  try {
    const { data, error } = await resend.emails.send({
      from: getVerifiedFromAddress(EMAIL_FROM),
      to,
      subject: `${riskEmoji} Scan Complete: ${subjectSiteName} — Risk Score ${riskScore}/100`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scan Complete - ADA Shield</title>
  <style>
    * { margin: 0; padding: 0; }
    body { background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .email-wrapper { background: #0f172a; width: 100%; padding: 40px 20px; }
    .email-container { max-width: 640px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { color: #818cf8; font-size: 28px; margin: 0; }
    .content-box { background: #1e293b; border-radius: 12px; padding: 40px; border: 1px solid rgba(255,255,255,0.1); }
    .content-box h2 { color: #fff; font-size: 22px; margin: 0 0 12px; }
    .content-box p { color: #94a3b8; line-height: 1.6; margin: 0 0 20px; }
    .strong { color: #fff; font-weight: 600; }
    .risk-score-box { text-align: center; padding: 32px 24px; background: #0f172a; border-radius: 8px; margin: 28px 0; }
    .risk-score-number { font-size: 56px; font-weight: bold; color: ${riskColor}; margin: 0; }
    .risk-score-label { color: #94a3b8; font-size: 14px; margin-top: 8px; }
    .stats-table { width: 100%; border-collapse: collapse; margin: 28px 0; background: #0f172a; border-radius: 8px; overflow: hidden; }
    .stats-table td { padding: 16px; text-align: center; border-right: 1px solid rgba(255,255,255,0.05); }
    .stats-table td:last-child { border-right: none; }
    .stat-number { color: #fff; font-size: 28px; font-weight: bold; display: block; margin-bottom: 4px; }
    .stat-label { color: #94a3b8; font-size: 13px; }
    .stat-critical .stat-number { color: #ef4444; }
    .stat-serious .stat-number { color: #f59e0b; }
    .cta-button { display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 20px; }
    .cta-button:hover { background: #4f46e5; }
    .footer { color: #475569; font-size: 12px; text-align: center; margin-top: 28px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <h1>🛡️ ADA Shield</h1>
      </div>
      <div class="content-box">
        <h2>✓ Scan Complete</h2>
        <p>Your accessibility scan for <span class="strong">${safeSiteName}</span> has finished.</p>
        
        <div class="risk-score-box">
          <div class="risk-score-number">${riskScore}</div>
          <div class="risk-score-label">Risk Score — ${riskLevel}</div>
        </div>

        <table class="stats-table">
          <tr>
            <td>
              <span class="stat-number">${totalViolations}</span>
              <span class="stat-label">Total Issues</span>
            </td>
            <td class="stat-critical">
              <span class="stat-number">${criticalCount}</span>
              <span class="stat-label">Critical</span>
            </td>
            <td class="stat-serious">
              <span class="stat-number">${seriousCount}</span>
              <span class="stat-label">Serious</span>
            </td>
          </tr>
        </table>

        <div style="text-align: center;">
          <a href="${dashboardUrl}" class="cta-button">View Full Report →</a>
        </div>
      </div>
      <div class="footer">
        You're receiving this because you have email notifications enabled on ADA Shield.
      </div>
    </div>
  </div>
</body>
</html>`,
    });

    if (error) throw error;
    logger.info('Scan complete email sent', { to, siteName, messageId: data?.id });
    return data;
  } catch (error) {
    logger.error('Failed to send scan complete email', { to, error: error.message });
    return null;
  }
}

/**
 * Sends a high-risk alert email when a site scores above threshold.
 */
async function sendRiskAlertEmail({ to, siteName, siteUrl, riskScore, criticalCount, seriousCount, dashboardUrl }) {
  const resend = getResendClient();
  if (!resend) {
    logger.warn('Resend not configured — skipping risk alert email');
    return null;
  }

  const safeSiteName = escapeHtml(siteName);
  const safeSiteUrl = escapeHtml(siteUrl);
  const subjectSiteName = sanitizeSubject(siteName);

  try {
    const { data, error } = await resend.emails.send({
      from: getVerifiedFromAddress(EMAIL_FROM),
      to,
      subject: `🚨 High Risk Alert: ${subjectSiteName} scored ${riskScore}/100`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Risk Alert - ADA Shield</title>
  <style>
    * { margin: 0; padding: 0; }
    body { background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .email-wrapper { background: #0f172a; width: 100%; padding: 40px 20px; }
    .email-container { max-width: 640px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { color: #818cf8; font-size: 28px; margin: 0; }
    .content-box { background: #1e293b; border-radius: 12px; padding: 40px; border: 2px solid #ef4444; }
    .alert-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .alert-header span { font-size: 36px; }
    .alert-header h2 { color: #ef4444; font-size: 22px; margin: 0; }
    .content-box p { color: #94a3b8; line-height: 1.6; margin: 0 0 16px; }
    .strong { color: #fff; font-weight: 600; }
    .risk-value { color: #ef4444; font-weight: 600; }
    .issues-box { background: #0f172a; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .issues-box p { color: #fff; margin: 0 0 8px; font-weight: 600; }
    .issues-list { color: #94a3b8; line-height: 1.8; }
    .issues-list .critical { color: #ef4444; }
    .issues-list .serious { color: #f59e0b; }
    .cta-button { display: inline-block; background: #ef4444; color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 20px; }
    .cta-button:hover { background: #dc2626; }
    .footer { color: #475569; font-size: 12px; text-align: center; margin-top: 28px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <h1>🛡️ ADA Shield</h1>
      </div>
      <div class="content-box">
        <div class="alert-header">
          <span>🚨</span>
          <h2>High Lawsuit Risk Detected</h2>
        </div>
        <p>
          Your site <span class="strong">${safeSiteName}</span> (${safeSiteUrl}) has a risk score of 
          <span class="risk-value">${riskScore}/100</span>, which indicates a high probability of ADA-related legal action.
        </p>
        
        <div class="issues-box">
          <p>Issues Found:</p>
          <div class="issues-list">
            <div class="critical">• <strong>${criticalCount}</strong> critical violations</div>
            <div class="serious">• <strong>${seriousCount}</strong> serious violations</div>
          </div>
        </div>

        <p>We recommend addressing critical violations immediately to reduce your risk exposure.</p>

        <div style="text-align: center;">
          <a href="${dashboardUrl}" class="cta-button">Fix Issues Now →</a>
        </div>
      </div>
      <div class="footer">
        You're receiving this because you have risk alerts enabled on ADA Shield.
      </div>
    </div>
  </div>
</body>
</html>`,
    });

    if (error) throw error;
    logger.info('Risk alert email sent', { to, siteName, riskScore, messageId: data?.id });
    return data;
  } catch (error) {
    logger.error('Failed to send risk alert email', { to, error: error.message });
    return null;
  }
}

/**
 * Sends a weekly monitoring summary email.
 */
async function sendWeeklySummaryEmail({ to, sites, dashboardUrl }) {
  const resend = getResendClient();
  if (!resend) {
    logger.warn('Resend not configured — skipping weekly summary email');
    return null;
  }

  const siteRows = sites
    .map((s) => {
      const riskColor = s.riskScore >= 70 ? '#ef4444' : s.riskScore >= 40 ? '#f59e0b' : '#22c55e';
      const riskClass = s.riskScore >= 70 ? 'risk-high' : s.riskScore >= 40 ? 'risk-medium' : 'risk-low';
      const trendClass = s.trend === 'up' ? 'trend-up' : s.trend === 'down' ? 'trend-down' : '';
      const safeName = escapeHtml(s.name);
      return `
        <tr>
          <td>${safeName}</td>
          <td><span class="${riskClass}">${s.riskScore}</span></td>
          <td>${s.totalViolations}</td>
          <td class="${trendClass}">${s.trend === 'up' ? '↑ Worse' : s.trend === 'down' ? '↓ Better' : '— Same'}</td>
        </tr>`;
    })
    .join('');

  const highRiskCount = sites.filter((s) => s.riskScore >= 70).length;

  try {
    const { data, error } = await resend.emails.send({
      from: getVerifiedFromAddress(EMAIL_FROM),
      to,
      subject: `📊 Weekly ADA Report — ${highRiskCount > 0 ? `${highRiskCount} site(s) at high risk` : 'All looking good'}`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Report - ADA Shield</title>
  <style>
    * { margin: 0; padding: 0; }
    body { background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .email-wrapper { background: #0f172a; width: 100%; padding: 40px 20px; }
    .email-container { max-width: 640px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { color: #818cf8; font-size: 28px; margin: 0; }
    .content-box { background: #1e293b; border-radius: 12px; padding: 40px; border: 1px solid rgba(255,255,255,0.1); }
    .content-box h2 { color: #fff; font-size: 22px; margin: 0 0 12px; }
    .content-box p { color: #94a3b8; line-height: 1.6; margin: 0 0 20px; }
    .data-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    .table-header { background: #0f172a; }
    .table-header th { padding: 12px; text-align: left; color: #94a3b8; font-size: 12px; text-transform: uppercase; font-weight: 600; border-bottom: 2px solid rgba(255,255,255,0.1); }
    .table-header th:nth-child(2),
    .table-header th:nth-child(3),
    .table-header th:nth-child(4) { text-align: center; }
    .table-body td { padding: 14px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #fff; }
    .table-body td:nth-child(2),
    .table-body td:nth-child(3),
    .table-body td:nth-child(4) { text-align: center; color: #94a3b8; }
    .risk-high { color: #ef4444; font-weight: 600; }
    .risk-medium { color: #f59e0b; font-weight: 600; }
    .risk-low { color: #22c55e; font-weight: 600; }
    .trend-up { color: #ef4444; }
    .trend-down { color: #22c55e; }
    .cta-button { display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 20px; }
    .cta-button:hover { background: #4f46e5; }
    .footer { color: #475569; font-size: 12px; text-align: center; margin-top: 28px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <h1>🛡️ ADA Shield</h1>
      </div>
      <div class="content-box">
        <h2>📊 Weekly Monitoring Report</h2>
        <p>Here's your weekly accessibility summary for <strong>${sites.length}</strong> monitored site(s).</p>
        
        <table class="data-table">
          <thead class="table-header">
            <tr>
              <th>Site</th>
              <th>Risk</th>
              <th>Issues</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody class="table-body">
            ${siteRows}
          </tbody>
        </table>

        <div style="text-align: center;">
          <a href="${dashboardUrl}" class="cta-button">View Dashboard →</a>
        </div>
      </div>
      <div class="footer">
        You're receiving this weekly summary because you have monitoring enabled on ADA Shield.
      </div>
    </div>
  </div>
</body>
</html>`,
    });

    if (error) throw error;
    logger.info('Weekly summary email sent', { to, siteCount: sites.length, messageId: data?.id });
    return data;
  } catch (error) {
    logger.error('Failed to send weekly summary email', { to, error: error.message });
    return null;
  }
}

/**
 * Sends a generic email (used for admin outreach).
 */
async function sendEmail({ to, subject, text, from = EMAIL_FROM }) {
  const resend = getResendClient();
  if (!resend) {
    logger.warn('Resend not configured — skipping email');
    return null;
  }

  const sanitizedSubject = sanitizeSubject(subject);
  const safeText = escapeHtml(text);
  const verifiedFrom = getVerifiedFromAddress(from);

  try {
    const { data, error } = await resend.emails.send({
      from: verifiedFrom,
      to,
      subject: sanitizedSubject,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:24px;">
      <h1 style="font-size:18px;margin:0 0 14px;color:#0f172a;">${sanitizedSubject}</h1>
      <div style="font-size:15px;line-height:1.7;white-space:pre-wrap;word-wrap:break-word;">${safeText}</div>
      <p style="margin:20px 0 0;color:#64748b;font-size:12px;">Sent via ADA Shield</p>
    </div>
  </div>
</body>
</html>`,
    });

    if (error) throw error;
    logger.info('Email sent', { to, subject: sanitizedSubject, messageId: data?.id });
    return data;
  } catch (error) {
    logger.error('Failed to send email', { to, subject: sanitizedSubject, error: error.message });
    throw error;
  }
}

module.exports = {
  sendScanCompleteEmail,
  sendRiskAlertEmail,
  sendWeeklySummaryEmail,
  sendEmail,
};
