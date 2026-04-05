const { Router } = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const { logger } = require('../utils/logger');
const { scanPage, calculateRiskScore } = require('@ada-shield/scanner');
const {
  getAdminStats,
  getAdminScans,
  getTopScannedUrls,
  getAdminUsers,
  getAdminSubscriptions,
  getAdminScanDetail,
  getAdminSites,
  updateAdminSiteMetadata,
  getSiteById,
  getLatestSiteScanSummary,
  markSiteAsContacted,
  createSiteContactHistoryEntry,
  getSiteContactHistory,
} = require('../db/admin');
const { saveScanResult, updateSiteLastScanned } = require('../db/scans');
const { createOrUpdateFreeScanSite } = require('../db/sites');
const { invokeSupabaseFunction } = require('../services/supabase-functions');
const { sendEmail, detectIndustry, getIndustryContext } = require('../services/email');

const router = Router();

const FIXED_ADMIN_CC_RECIPIENTS = [
  'tthirmal@gmail.com',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_CACHE_TTL_MS = Math.max(1000, parseInt(process.env.ADMIN_CACHE_TTL_MS || '30000', 10) || 30000);
const adminReadCache = new Map();

function getCachedAdminValue(cacheKey, loader) {
  const cached = adminReadCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }

  return Promise.resolve(loader()).then((value) => {
    adminReadCache.set(cacheKey, {
      value,
      expiresAt: now + ADMIN_CACHE_TTL_MS,
    });
    return value;
  });
}

/**
 * Admin auth middleware — validates INTERNAL_API_SECRET header.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function adminAuth(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  const expected = process.env.INTERNAL_API_SECRET;
  if (!secret || !expected) {
    return res.status(401).json({ error: 'Unauthorized — invalid admin secret' });
  }

  // Timing-safe comparison to prevent side-channel attacks
  const secretBuf = Buffer.from(String(secret));
  const expectedBuf = Buffer.from(String(expected));
  if (secretBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(secretBuf, expectedBuf)) {
    return res.status(401).json({ error: 'Unauthorized — invalid admin secret' });
  }
  next();
}

// Apply admin auth to all routes
router.use(adminAuth);

// ── Overview Stats ──────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getCachedAdminValue('stats', () => getAdminStats());
    return res.json(stats);
  } catch (error) {
    next(error);
  }
});

// ── Recent Scans ────────────────────────────────────────────────────
router.get('/scans', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const type = ['free', 'authenticated'].includes(req.query.type) ? req.query.type : undefined;

    const cacheKey = `scans:${page}:${limit}:${type || 'all'}`;
    const result = await getCachedAdminValue(cacheKey, () => getAdminScans({ page, limit, type }));
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── Top Scanned URLs ────────────────────────────────────────────────
router.get('/scans/top-urls', async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const cacheKey = `top-urls:${limit}`;
    const topUrls = await getCachedAdminValue(cacheKey, () => getTopScannedUrls(limit));
    return res.json(topUrls);
  } catch (error) {
    next(error);
  }
});

// ── Scan Detail ─────────────────────────────────────────────────────
router.get('/scans/:scanId', async (req, res, next) => {
  try {
    const scan = await getAdminScanDetail(req.params.scanId);
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    return res.json(scan);
  } catch (error) {
    next(error);
  }
});

// ── Users ───────────────────────────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const cacheKey = `users:${page}:${limit}`;
    const result = await getCachedAdminValue(cacheKey, () => getAdminUsers({ page, limit }));
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── Sites ───────────────────────────────────────────────────────────
router.get('/sites', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const sortBy = String(req.query.sortBy || 'created_at');
    const sortOrder = String(req.query.sortOrder || 'desc');

    const normalizeDateBoundary = (value, boundary) => {
      if (value === undefined || value === null) return undefined;
      const raw = String(value).trim();
      if (!raw) return undefined;

      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return boundary === 'start'
          ? `${raw}T00:00:00.000Z`
          : `${raw}T23:59:59.999Z`;
      }

      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return undefined;
      return parsed.toISOString();
    };
    
    // Parse filter parameters
    let type = undefined;
    if (req.query.type && ['free', 'admin', 'registered'].includes(String(req.query.type))) {
      type = String(req.query.type);
    }
    
    let contracted = undefined;
    if (req.query.contracted !== undefined) {
      contracted = req.query.contracted === 'true' ? true : req.query.contracted === 'false' ? false : undefined;
    }

    let risk = undefined;
    if (req.query.risk && ['high', 'medium', 'low', 'unscanned'].includes(String(req.query.risk))) {
      risk = String(req.query.risk);
    }

    const scannedFrom = normalizeDateBoundary(req.query.scannedFrom, 'start');
    const scannedTo = normalizeDateBoundary(req.query.scannedTo, 'end');

    if (scannedFrom && scannedTo && new Date(scannedFrom) > new Date(scannedTo)) {
      return res.status(400).json({
        error: 'Validation failed',
        details: {
          scannedFrom: ['scannedFrom must be before or equal to scannedTo'],
        },
      });
    }

    const cacheKey = [
      'sites',
      page,
      limit,
      sortBy,
      sortOrder,
      type || 'all',
      contracted === undefined ? 'all' : String(contracted),
      risk || 'all',
      scannedFrom || '',
      scannedTo || '',
    ].join(':');

    const result = await getCachedAdminValue(cacheKey, () => getAdminSites({
      page,
      limit,
      sortBy,
      sortOrder,
      type,
      contracted,
      risk,
      scannedFrom,
      scannedTo,
    }));
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

const adminSitePatchSchema = z.object({
  owner_name: z.string().trim().max(120).nullable().optional(),
  owner_email: z.string().trim().max(1000).nullable().optional(),
  notification_recipients: z.string().trim().max(4000).optional().nullable(),
});

function parseEmailList(value) {
  if (!value || typeof value !== 'string') return [];

  return value
    .split(/[;,\n]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

router.patch('/sites/:siteId', async (req, res, next) => {
  try {
    const parsed = adminSitePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const patch = {};
    const ownerEmails = parseEmailList(parsed.data.owner_email);
    const extraEmails = parseEmailList(parsed.data.notification_recipients);
    const invalidEmails = [...ownerEmails, ...extraEmails].filter((email) => !EMAIL_REGEX.test(email));

    if (invalidEmails.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: {
          owner_email: [`Invalid email address(es): ${invalidEmails.join(', ')}`],
        },
      });
    }

    if (parsed.data.owner_name !== undefined) {
      patch.owner_name = typeof parsed.data.owner_name === 'string' && parsed.data.owner_name.trim() === ''
        ? null
        : parsed.data.owner_name;
    }

    if (parsed.data.owner_email !== undefined) {
      patch.owner_email = ownerEmails[0] || null;
    }

    if (parsed.data.notification_recipients !== undefined || parsed.data.owner_email !== undefined) {
      const mergedRecipients = [...new Set([...ownerEmails.slice(1), ...extraEmails])];
      patch.notification_recipients = mergedRecipients;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }

    const updated = await updateAdminSiteMetadata(req.params.siteId, patch);
    return res.json({ site: updated });
  } catch (error) {
    next(error);
  }
});

const sendEmailSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  templateStyle: z.enum(['fear_urgency', 'friendly_educational', 'concise_direct']).optional(),
});

const adminBulkScanSchema = z.object({
  urls: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'URL is required')
    )
    .min(1)
    .max(50),
});

function normalizeScanUrl(input) {
  const value = String(input || '').trim();
  if (!value) return null;

  // Auto-prefix plain domains like "google.com" with https
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch (_) {
    return null;
  }
}

async function runAdminScanForUrl(url) {
  const scanResult = await scanPage(url);
  const riskResult = calculateRiskScore(scanResult.violations);
  const industry = detectIndustry(scanResult.url);

  let siteId = null;
  try {
    const freeSite = await createOrUpdateFreeScanSite({
      url: scanResult.url,
      ownerName: scanResult.pageMetadata?.companyName,
      ownerEmail: scanResult.pageMetadata?.contactEmail,
      type: 'admin',
    });
    siteId = freeSite?.id || null;
  } catch (_) {
    // Best effort site linkage — scan still succeeds.
  }

  const saved = await saveScanResult({
    url: scanResult.url,
    siteId,
    userId: null,
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
  });

  if (siteId) {
    await updateSiteLastScanned(siteId);
  }

  return {
    url: scanResult.url,
    status: 'success',
    scanId: saved.id,
    riskScore: riskResult.score,
    totalViolations: scanResult.totalViolations,
    industry,
    companyName: scanResult.pageMetadata?.companyName || null,
    contactEmail: scanResult.pageMetadata?.contactEmail || null,
    supportEmail: scanResult.pageMetadata?.supportEmail || null,
    allEmails: Array.isArray(scanResult.pageMetadata?.allEmails) ? scanResult.pageMetadata.allEmails : [],
  };
}

// ── Admin Bulk Scan (No free-scan limits) ──────────────────────────
router.post('/scans/run', async (req, res, next) => {
  try {
    const parsed = adminBulkScanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const normalized = parsed.data.urls
      .map((u) => ({ raw: u, normalized: normalizeScanUrl(u) }))
      .filter((item) => item.normalized);

    if (normalized.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: { urls: ['Provide at least one valid URL or domain (e.g., google.com or https://google.com)'] },
      });
    }

    const invalidRaw = parsed.data.urls.filter((u) => !normalizeScanUrl(u));
    if (invalidRaw.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: { urls: [`Invalid URL(s): ${invalidRaw.join(', ')}`] },
      });
    }

    const urls = [...new Set(normalized.map((item) => item.normalized))];
    const results = [];
    const concurrency = Math.min(4, urls.length);
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= urls.length) break;

        const url = urls[currentIndex];
        try {
          const result = await runAdminScanForUrl(url);
          results.push(result);
        } catch (scanError) {
          results.push({
            url,
            status: 'failed',
            error: scanError.message || 'Scan failed',
          });
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.length - successCount;

    logger.info('Admin bulk scan completed', {
      requestedCount: urls.length,
      successCount,
      failedCount,
    });

    return res.json({
      success: true,
      requestedCount: urls.length,
      successCount,
      failedCount,
      results,
    });
  } catch (error) {
    next(error);
  }
});

function getEmailSendFailureMessage(rawMessage) {
  const message = String(rawMessage || 'Failed to send email');
  const lower = message.toLowerCase();

  if (
    lower.includes('verify') && lower.includes('domain') ||
    lower.includes('domain not verified')
  ) {
    return 'Email sender domain is not verified in Resend. Verify your domain and set EMAIL_FROM to that domain.';
  }

  if (
    lower.includes('testing emails') ||
    lower.includes('test emails') ||
    lower.includes('only send') && lower.includes('own email') ||
    lower.includes('onboarding@resend.dev')
  ) {
    return 'Resend test mode restriction: onboarding@resend.dev can send only to limited/test recipients. Verify a custom domain and use EMAIL_FROM on that domain to send to any address.';
  }

  if (lower.includes('invalid') && lower.includes('email')) {
    return 'Recipient email appears invalid. Please check the owner email and try again.';
  }

  return message;
}

function extractFirstName(ownerName) {
  if (!ownerName) return 'there';
  const first = String(ownerName).trim().split(/\s+/)[0];
  return first || 'there';
}

function inferCityFromUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, '');
    const firstLabel = host.split('.')[0] || '';
    if (!firstLabel || /^\d+$/.test(firstLabel) || firstLabel.length < 4) {
      return 'your area';
    }
    const city = firstLabel.replace(/[-_]/g, ' ').trim();
    return city || 'your area';
  } catch (_) {
    return 'your area';
  }
}

function getIndustryYearlyStatistics(industry) {
  const stats = {
    restaurant: '300+ ADA lawsuits filed annually in food service',
    insurance: '250+ ADA claims per year against insurance providers',
    healthcare: '400+ ADA accessibility cases yearly in healthcare',
    finance: '350+ ADA lawsuits annually affecting financial services',
    ecommerce: '500+ ADA accessibility disputes yearly in retail',
    education: '280+ ADA cases filed against educational institutions',
    tech: '350+ ADA lawsuits targeting technology companies annually',
    government: '450+ public sector ADA violations addressed yearly',
    manufacturing: '180+ ADA accessibility cases in manufacturing sector',
    generic: '15,000+ digital accessibility lawsuits filed annually in the US',
  };
  return stats[industry] || stats.generic;
}

function normalizeStyle(style) {
  const allowed = new Set(['fear_urgency', 'friendly_educational', 'concise_direct']);
  return allowed.has(style) ? style : null;
}

function pickDefaultTemplateStyle(riskScore) {
  if (Number.isFinite(riskScore) && riskScore >= 70) return 'fear_urgency';
  if (Number.isFinite(riskScore) && riskScore >= 40) return 'concise_direct';
  return 'friendly_educational';
}

function formatIndustryLabel(industry) {
  const labels = {
    restaurant: 'Restaurant / Food Service',
    insurance: 'Insurance',
    healthcare: 'Healthcare',
    finance: 'Finance',
    ecommerce: 'E-commerce',
    education: 'Education',
    tech: 'Technology',
    government: 'Government / Public Sector',
    manufacturing: 'Manufacturing',
    generic: 'General Business',
  };
  return labels[industry] || labels.generic;
}

function buildTopIssuesSummary(violations, dashboardUrl) {
  if (!Array.isArray(violations) || violations.length === 0) {
    return {
      summaryText: 'No detailed issue breakdown is available from this scan snapshot.',
      hiddenCount: 0,
    };
  }

  const impactPriority = {
    critical: 4,
    serious: 3,
    moderate: 2,
    minor: 1,
  };

  const sorted = [...violations].sort((a, b) => {
    const aScore = impactPriority[a?.impact] || 0;
    const bScore = impactPriority[b?.impact] || 0;
    return bScore - aScore;
  });

  const topTwo = sorted.slice(0, 2);
  const hiddenCount = Math.max(0, sorted.length - topTwo.length);

  const lines = topTwo.map((issue, index) => {
    const title = issue?.help || issue?.id || 'Accessibility issue';
    const quickFixRaw = issue?.affectedElements?.[0]?.actionRequired
      || issue?.affectedElements?.[0]?.explanation
      || 'Apply WCAG 2.1 AA fix guidance for this issue.';
    const quickFix = String(quickFixRaw).split('. ')[0].trim();

    return `${index + 1}. ${title}\n   Quick fix: ${quickFix}${quickFix.endsWith('.') ? '' : '.'}`;
  });

  const loginLine = hiddenCount > 0
    ? `\nTo see the other ${hiddenCount} issue(s) and full fixes, please login for free: ${dashboardUrl}`
    : '';

  return {
    summaryText: `${lines.join('\n\n')}${loginLine}`,
    hiddenCount,
  };
}

function buildEmailTemplates({ firstName, siteName, issueText, riskScore, industry, topIssuesSummary }) {
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://ada-shield-dashboard.vercel.app';
  const riskScoreText = Number.isFinite(riskScore) ? `${riskScore}/100` : 'elevated';

  const templates = {
    fear_urgency: {
  subject: 'Quick heads-up about your website',
      message: `Hi ${firstName},

I ran a quick accessibility check on your website and your risk score came out quite high (${riskScoreText}).

A few issues (like text contrast and missing labels) could make parts of your site difficult to use and potentially expose you to ADA-related complaints.

I’ve put together a short report showing the exact fixes:
${dashboardUrl}

No pressure, just sharing in case it helps you address this early.

Thirmal
ADA Shield`,
    },
    friendly_educational: {
  subject: 'Small improvement opportunity for your website',
      message: `Hi ${firstName},

I was reviewing your website and noticed a few accessibility improvements that could enhance user experience.

Things like color contrast and image descriptions can impact how easily people navigate your site.

I created a quick, free report with suggestions:
${dashboardUrl}

Even small fixes here can make a noticeable difference.

Thirmal
ADA Shield`,
    },
    concise_direct: {
  subject: 'Quick check on your website',
      message: `Hi ${firstName},

I ran a quick accessibility scan on your website and found a couple of minor things you might want to review.

Here’s a short report:
${dashboardUrl}

Thought I’d share, it’s free.

Thirmal
ADA Shield`,
    },
  };

  return templates;
}

router.get('/sites/:siteId/email-template', async (req, res, next) => {
  try {
    const site = await getSiteById(req.params.siteId);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const latestScan = await getLatestSiteScanSummary(req.params.siteId);
    const firstName = extractFirstName(site.owner_name);
    const siteName = site.name || site.url;
    const issueCount = Number.isFinite(latestScan?.total_violations)
      ? latestScan.total_violations
      : 0;
    const issueText = issueCount > 0 ? String(issueCount) : 'multiple';
    const industry = detectIndustry(site.url);
    const dashboardUrl = process.env.DASHBOARD_URL || 'https://ada-shield-dashboard.vercel.app';
    const { summaryText: topIssuesSummary } = buildTopIssuesSummary(latestScan?.violations || [], dashboardUrl);
    const templates = buildEmailTemplates({
      firstName,
      siteName,
      issueText,
      riskScore: latestScan?.risk_score,
      industry,
      topIssuesSummary,
    });

    const defaultStyle = pickDefaultTemplateStyle(latestScan?.risk_score);
    const requestedStyle = normalizeStyle(String(req.query.style || '').trim());
    const selectedStyle = requestedStyle || defaultStyle;
    const selectedTemplate = templates[selectedStyle];

    return res.json({
      style: selectedStyle,
      defaultStyle,
      styles: [
        { key: 'fear_urgency', label: 'Fear + Urgency' },
        { key: 'friendly_educational', label: 'Friendly + Educational' },
        { key: 'concise_direct', label: 'Concise + Direct' },
      ],
      templates,
      subject: selectedTemplate.subject,
      message: selectedTemplate.message,
      dynamic: {
        firstName,
        siteName,
        industry,
        industryLabel: formatIndustryLabel(industry),
        issueCount: issueCount > 0 ? issueCount : null,
        riskScore: latestScan?.risk_score ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/sites/:siteId/send-email', async (req, res, next) => {
  try {
    const parsed = sendEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const site = await getSiteById(req.params.siteId);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }


      // Allow sending without owner_email when extra recipients exist
      if (!site.owner_email && (!site.notification_recipients || !site.notification_recipients.length)) {
        return res.status(400).json({ error: 'Site has no owner email address and no notification recipients' });
      }

    let deliveryChannel = 'supabase-function';
    let providerMessageId = null;

    // Collect all site-related recipients for TO list (owner + notification recipients)
    const toRecipients = new Set();
    if (site.owner_email) toRecipients.add(site.owner_email);
    if (site.notification_recipients && Array.isArray(site.notification_recipients)) {
      site.notification_recipients.forEach((email) => toRecipients.add(email));
    }

    if (toRecipients.size === 0) {
      return res.status(400).json({ error: 'No recipient emails configured for this site' });
    }

    // Fixed admin CC (only thermal for monitoring)
    const ccRecipients = FIXED_ADMIN_CC_RECIPIENTS;
    const toList = Array.from(toRecipients);

    // Primary path: Supabase Edge Function (Resend)
    // Fallback path: direct API-side sendEmail if function call fails.
    try {
      const response = await invokeSupabaseFunction('send-admin-email', {
        to: toList,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        subject: parsed.data.subject,
        message: parsed.data.message,
        siteId: site.id,
        siteName: site.name,
        siteUrl: site.url,
      });
      providerMessageId = response?.messageId || null;
    } catch (edgeError) {
      logger.warn('Edge function send failed, using local email fallback', {
        siteId: site.id,
        to: toList.join(','),
        cc: ccRecipients,
        error: edgeError.message,
      });

      try {
        deliveryChannel = 'api-fallback';
        const fallbackResponse = await sendEmail({
          to: toList,
          subject: parsed.data.subject,
          text: parsed.data.message,
          cc: ccRecipients,
        });
        providerMessageId = fallbackResponse?.id || null;
      } catch (fallbackError) {
        const providerMessage = fallbackError?.message || edgeError?.message || 'Failed to send email';
        const userMessage = getEmailSendFailureMessage(providerMessage);

        return res.status(400).json({
          error: userMessage,
          details: providerMessage,
             recipient: toList.join(','),
        });
      }
    }

    // Log the first recipient for contact history
    const firstToRecipient = Array.from(toRecipients)[0];
    await createSiteContactHistoryEntry({
      siteId: site.id,
         recipientEmail: firstToRecipient,
      subject: parsed.data.subject,
      message: parsed.data.message,
      templateStyle: parsed.data.templateStyle || null,
      deliveryChannel,
      deliveryStatus: 'sent',
      providerMessageId,
    });

    // Mark site as contacted
    await markSiteAsContacted(req.params.siteId);

    return res.json({ 
      success: true, 
      message: 'Email sent and contact recorded' 
    });
  } catch (error) {
    next(error);
  }
});

router.get('/sites/:siteId/contact-history', async (req, res, next) => {
  try {
    const site = await getSiteById(req.params.siteId);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const result = await getSiteContactHistory(req.params.siteId, { page, limit });

    return res.json({
      site: {
        id: site.id,
        name: site.name,
        url: site.url,
        owner_email: site.owner_email,
      },
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// ── Subscriptions ───────────────────────────────────────────────────
router.get('/subscriptions', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const cacheKey = `subscriptions:${page}:${limit}`;
    const result = await getCachedAdminValue(cacheKey, () => getAdminSubscriptions({ page, limit }));
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── Blog Posts ──────────────────────────────────────────────────────
const { supabase: adminSupabase } = require('../db/supabase');

// List all posts (drafts + published)
router.get('/blog', async (req, res, next) => {
  try {
    const { data, error } = await adminSupabase
      .from('blog_posts')
      .select('id, slug, title, excerpt, author, tags, published, published_at, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    next(error);
  }
});

// Create post
router.post('/blog', async (req, res, next) => {
  try {
    const { slug, title, excerpt, content, cover_image, author, tags, published } = req.body;
    if (!slug || !title || !content) {
      return res.status(400).json({ error: 'slug, title, and content are required' });
    }
    const { data, error } = await adminSupabase
      .from('blog_posts')
      .insert({ slug, title, excerpt, content, cover_image: cover_image || null, author, tags: tags || [], published: !!published })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// Update post
router.put('/blog/:id', async (req, res, next) => {
  try {
    const { slug, title, excerpt, content, cover_image, author, tags, published } = req.body;
    const { data, error } = await adminSupabase
      .from('blog_posts')
      .update({ slug, title, excerpt, content, cover_image: cover_image || null, author, tags: tags || [], published: !!published })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Post not found' });
    return res.json(data);
  } catch (error) {
    next(error);
  }
});

// Delete post
router.delete('/blog/:id', async (req, res, next) => {
  try {
    const { error } = await adminSupabase
      .from('blog_posts')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
});

const adminRoutes = router;
module.exports = { adminRoutes };
