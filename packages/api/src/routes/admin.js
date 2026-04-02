const { Router } = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const { logger } = require('../utils/logger');
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
const { invokeSupabaseFunction } = require('../services/supabase-functions');
const { sendEmail } = require('../services/email');

const router = Router();

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

    const result = await getAdminSites({ page, limit, sortBy, sortOrder });
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

const adminSitePatchSchema = z.object({
  owner_name: z.string().trim().max(120).nullable().optional(),
  owner_email: z.string().trim().email().max(254).nullable().optional(),
});

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
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value === undefined) continue;
      patch[key] = typeof value === 'string' && value.trim() === '' ? null : value;
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

function normalizeStyle(style) {
  const allowed = new Set(['fear_urgency', 'friendly_educational', 'concise_direct']);
  return allowed.has(style) ? style : null;
}

function pickDefaultTemplateStyle(riskScore) {
  if (Number.isFinite(riskScore) && riskScore >= 70) return 'fear_urgency';
  if (Number.isFinite(riskScore) && riskScore >= 40) return 'concise_direct';
  return 'friendly_educational';
}

function buildEmailTemplates({ firstName, restaurantName, city, issueText }) {
  const dashboardUrl = 'https://ada-shield-dashboard.vercel.app';
  const supportLine = 'If you have any questions, you can reach me at tthirmal@gmail.com.';

  const templates = {
    fear_urgency: {
      subject: `[noreplay] Is ${restaurantName} protected from ADA lawsuits?`,
      message: `Hi ${firstName},

Quick question - has anyone ever mentioned ADA website compliance to you?

I ask because I've been scanning restaurant websites in ${city} this week, and ${restaurantName} came up with ${issueText} violations that match what plaintiff lawyers specifically look for.

The restaurant industry is one of the top 5 most targeted industries for ADA web lawsuits. The average settlement is $5,000-$25,000, and that is before legal fees.

I built a tool that gives you a 0-100 lawsuit risk score and shows the exact code to fix every issue. It takes 30 seconds to check.

Free scan here: ${dashboardUrl}

Worth checking before a lawyer does it for you.

${supportLine}

Thirmal
ADA Shield
${dashboardUrl}`,
    },
    friendly_educational: {
  subject: `[noreplay] Quick ADA check for ${restaurantName}`,
      message: `Hi ${firstName},

I hope you are doing well. I ran a quick accessibility check for ${restaurantName} and found ${issueText} items worth fixing.

These are common issues restaurants usually miss, like contrast, missing labels, and image alt text. They can affect both user experience and ADA compliance risk.

I built ADA Shield to make this easy: you get a 0-100 lawsuit risk score and exact code-level fixes in about 30 seconds.

Run your free scan here: ${dashboardUrl}

If you want, I can also share the top 2 priority fixes first.

${supportLine}

Thirmal
ADA Shield
${dashboardUrl}`,
    },
    concise_direct: {
  subject: `[noreplay] ${restaurantName}: ADA risk snapshot`,
      message: `Hi ${firstName},

I scanned ${restaurantName} and found ${issueText} ADA-related web issues.

Why this matters:
- Restaurants are a frequent ADA lawsuit target
- Typical settlements can be costly before legal fees

ADA Shield gives you:
- 0-100 lawsuit risk score
- Exact fix suggestions for each issue

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
    const restaurantName = site.name || site.url;
    const city = inferCityFromUrl(site.url);
    const issueCount = Number.isFinite(latestScan?.total_violations)
      ? latestScan.total_violations
      : 0;
    const issueText = issueCount > 0 ? String(issueCount) : 'multiple';
    const templates = buildEmailTemplates({
      firstName,
      restaurantName,
      city,
      issueText,
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
        restaurantName,
        city,
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

    if (!site.owner_email) {
      return res.status(400).json({ error: 'Site has no owner email address' });
    }

    let deliveryChannel = 'supabase-function';
    let providerMessageId = null;

    // Primary path: Supabase Edge Function (Resend)
    // Fallback path: direct API-side sendEmail if function call fails.
    try {
      const response = await invokeSupabaseFunction('send-admin-email', {
        to: site.owner_email,
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
        to: site.owner_email,
        error: edgeError.message,
      });

      try {
        deliveryChannel = 'api-fallback';
        const fallbackResponse = await sendEmail({
          to: site.owner_email,
          subject: parsed.data.subject,
          text: parsed.data.message,
        });
        providerMessageId = fallbackResponse?.id || null;
      } catch (fallbackError) {
        const providerMessage = fallbackError?.message || edgeError?.message || 'Failed to send email';
        const userMessage = getEmailSendFailureMessage(providerMessage);

        return res.status(400).json({
          error: userMessage,
          details: providerMessage,
          recipient: site.owner_email,
        });
      }
    }

    await createSiteContactHistoryEntry({
      siteId: site.id,
      recipientEmail: site.owner_email,
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
