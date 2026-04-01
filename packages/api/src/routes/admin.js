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
  markSiteAsContacted,
} = require('../db/admin');
const { invokeSupabaseFunction } = require('../services/supabase-functions');

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

    const result = await getAdminSites({ page, limit });
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

    // Send email through Supabase Edge Function (Resend)
    await invokeSupabaseFunction('send-admin-email', {
      to: site.owner_email,
      subject: parsed.data.subject,
      message: parsed.data.message,
      siteId: site.id,
      siteName: site.name,
      siteUrl: site.url,
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
