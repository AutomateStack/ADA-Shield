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
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#818cf8;font-size:24px;margin:0;">🛡️ ADA Shield</h1>
    </div>
    <div style="background:#1e293b;border-radius:12px;padding:32px;border:1px solid rgba(255,255,255,0.1);">
      <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Scan Complete</h2>
      <p style="color:#94a3b8;margin:0 0 24px;">Your accessibility scan for <strong style="color:#fff;">${safeSiteName}</strong> has finished.</p>
      
      <div style="text-align:center;padding:24px;background:#0f172a;border-radius:8px;margin-bottom:24px;">
        <div style="font-size:48px;font-weight:bold;color:${riskColor};">${riskScore}</div>
        <div style="color:#94a3b8;font-size:14px;margin-top:4px;">Risk Score — ${riskLevel}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:12px;background:#0f172a;border-radius:8px 0 0 8px;text-align:center;">
            <div style="color:#fff;font-size:24px;font-weight:bold;">${totalViolations}</div>
            <div style="color:#94a3b8;font-size:12px;">Total Issues</div>
          </td>
          <td style="padding:12px;background:#0f172a;text-align:center;">
            <div style="color:#ef4444;font-size:24px;font-weight:bold;">${criticalCount}</div>
            <div style="color:#94a3b8;font-size:12px;">Critical</div>
          </td>
          <td style="padding:12px;background:#0f172a;border-radius:0 8px 8px 0;text-align:center;">
            <div style="color:#f59e0b;font-size:24px;font-weight:bold;">${seriousCount}</div>
            <div style="color:#94a3b8;font-size:12px;">Serious</div>
          </td>
        </tr>
      </table>

      <div style="text-align:center;">
        <a href="${dashboardUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">
          View Full Report →
        </a>
      </div>
    </div>
    <p style="color:#475569;font-size:12px;text-align:center;margin-top:24px;">
      You're receiving this because you have email notifications enabled on ADA Shield.
    </p>
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
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#818cf8;font-size:24px;margin:0;">🛡️ ADA Shield</h1>
    </div>
    <div style="background:#1e293b;border-radius:12px;padding:32px;border:1px solid #ef4444;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <span style="font-size:32px;">🚨</span>
        <h2 style="color:#ef4444;font-size:20px;margin:0;">High Lawsuit Risk Detected</h2>
      </div>
      <p style="color:#94a3b8;margin:0 0 24px;">
        Your site <strong style="color:#fff;">${safeSiteName}</strong> (${safeSiteUrl}) has a risk score of 
        <strong style="color:#ef4444;">${riskScore}/100</strong>, which indicates a high probability of ADA-related legal action.
      </p>
      
      <div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="color:#fff;margin:0 0 8px;font-weight:600;">Issues Found:</p>
        <p style="color:#ef4444;margin:0;">• ${criticalCount} critical violations</p>
        <p style="color:#f59e0b;margin:0;">• ${seriousCount} serious violations</p>
      </div>

      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">
        We recommend addressing critical violations immediately to reduce your risk exposure.
      </p>

      <div style="text-align:center;">
        <a href="${dashboardUrl}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">
          Fix Issues Now →
        </a>
      </div>
    </div>
    <p style="color:#475569;font-size:12px;text-align:center;margin-top:24px;">
      You're receiving this because you have risk alerts enabled on ADA Shield.
    </p>
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
      const safeName = escapeHtml(s.name);
      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);color:#fff;">${safeName}</td>
          <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">
            <span style="color:${riskColor};font-weight:bold;">${s.riskScore}</span>
          </td>
          <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;color:#94a3b8;">${s.totalViolations}</td>
          <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;color:${
            s.trend === 'up' ? '#ef4444' : s.trend === 'down' ? '#22c55e' : '#94a3b8'
          };">${s.trend === 'up' ? '↑ Worse' : s.trend === 'down' ? '↓ Better' : '— Same'}</td>
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
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#818cf8;font-size:24px;margin:0;">🛡️ ADA Shield</h1>
    </div>
    <div style="background:#1e293b;border-radius:12px;padding:32px;border:1px solid rgba(255,255,255,0.1);">
      <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Weekly Monitoring Report</h2>
      <p style="color:#94a3b8;margin:0 0 24px;">Here's your weekly accessibility summary for ${sites.length} monitored site(s).</p>
      
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:2px solid rgba(255,255,255,0.1);">
            <th style="padding:8px 12px;text-align:left;color:#94a3b8;font-size:12px;text-transform:uppercase;">Site</th>
            <th style="padding:8px 12px;text-align:center;color:#94a3b8;font-size:12px;text-transform:uppercase;">Risk</th>
            <th style="padding:8px 12px;text-align:center;color:#94a3b8;font-size:12px;text-transform:uppercase;">Issues</th>
            <th style="padding:8px 12px;text-align:center;color:#94a3b8;font-size:12px;text-transform:uppercase;">Trend</th>
          </tr>
        </thead>
        <tbody>${siteRows}</tbody>
      </table>

      <div style="text-align:center;margin-top:24px;">
        <a href="${dashboardUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">
          View Dashboard →
        </a>
      </div>
    </div>
    <p style="color:#475569;font-size:12px;text-align:center;margin-top:24px;">
      You're receiving this weekly summary because you have monitoring enabled on ADA Shield.
    </p>
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
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#818cf8;font-size:24px;margin:0;">🛡️ ADA Shield</h1>
    </div>
    <div style="background:#1e293b;border-radius:12px;padding:32px;border:1px solid rgba(255,255,255,0.1);">
      <h2 style="color:#fff;font-size:20px;margin:0 0 24px;">${sanitizedSubject}</h2>
      <div style="color:#cbd5e1;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;">${safeText}</div>
    </div>
    <p style="color:#475569;font-size:12px;text-align:center;margin-top:24px;">
      You're receiving this from ADA Shield.
    </p>
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
