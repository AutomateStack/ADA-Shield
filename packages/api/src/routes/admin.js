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
    const stats = await getAdminStats();
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

    const result = await getAdminScans({ page, limit, type });
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── Top Scanned URLs ────────────────────────────────────────────────
router.get('/scans/top-urls', async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const topUrls = await getTopScannedUrls(limit);
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

    const result = await getAdminUsers({ page, limit });
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

    const result = await getAdminSites({ page, limit, sortBy, sortOrder, type, contracted, risk });
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
        .url('Invalid URL')
        .refine((url) => url.startsWith('http://') || url.startsWith('https://'), 'URL must start with http:// or https://')
    )
    .min(1)
    .max(50),
});

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

    const urls = [...new Set(parsed.data.urls.map((u) => u.trim()))];
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

function buildEmailTemplates({ firstName, siteName, issueText, riskScore, industry }) {
  const dashboardUrl = 'https://ada-shield-dashboard.vercel.app';
  const supportLine = 'If you have any questions, you can reach me at tthirmal@gmail.com.';
  const riskScoreText = Number.isFinite(riskScore) ? `${riskScore}/100` : 'elevated';
  const { riskContext, callSignal } = getIndustryContext(industry);
  const yearlyStats = getIndustryYearlyStatistics(industry);

  const templates = {
    fear_urgency: {
      subject: `[noreply] ${siteName}: accessibility risk alert`,
      message: `Hi ${firstName},

I ran an ADA accessibility check for ${siteName} and found ${issueText} issues that can increase legal risk.

Risk signal: ${riskScoreText}
${yearlyStats}

Why this matters:
${riskContext}

Recommended action:
${callSignal}

ADA Shield gives you:
- 0-100 lawsuit risk score
- Exact fix suggestions for each issue

Run a fresh scan: ${dashboardUrl}

${supportLine}

Thirmal
ADA Shield`,
    },
    friendly_educational: {
      subject: `[noreply] Quick accessibility snapshot for ${siteName}`,
      message: `Hi ${firstName},

I reviewed ${siteName} and found ${issueText} accessibility items worth fixing.

${yearlyStats}

Accessibility improvements help reduce legal exposure and improve user experience for all visitors.

Context:
${riskContext}

ADA Shield can help with:
- 0-100 risk scoring
- Prioritized, code-level fixes

Run your scan here: ${dashboardUrl}

${supportLine}

Thirmal
ADA Shield`,
    },
    concise_direct: {
      subject: `[noreply] ${siteName}: ADA risk snapshot`,
      message: `Hi ${firstName},

I scanned ${siteName} and found ${issueText} ADA-related issues.

Risk signal: ${riskScoreText}
${yearlyStats}

Why this matters:
${riskContext}

Next step:
${callSignal}

Free scan: ${dashboardUrl}

${supportLine}

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
    const templates = buildEmailTemplates({
      firstName,
      siteName,
      issueText,
      riskScore: latestScan?.risk_score,
      industry,
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

    const result = await getAdminSubscriptions({ page, limit });
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
