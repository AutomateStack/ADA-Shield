/**
 * Bulk Import Routes — POST /api/admin/bulk-import
 *
 * Accepts an Excel file (.xlsx/.xls) with columns:
 *   Site URL, Email, Facebook URL, Instagram URL, Phone
 *
 * For each row it:
 *   - Normalises and validates the URL
 *   - Upserts a site record (type = 'admin', import_source = 'excel_bulk_import')
 *   - Stores Facebook, Instagram, Phone in the new columns
 *   - Skips sites that already have contact history (already emailed)
 *   - Enqueues the site in the bulk-outreach BullMQ queue for
 *     scan + email (capped at 2/day by the worker limiter)
 *
 * GET /api/admin/bulk-import/batches — returns recent import batches
 * GET /api/admin/bulk-import/queue-status — pending / active site counts
 */

const { Router } = require('express');
const crypto = require('crypto');
const multer = require('multer');
const XLSX = require('xlsx');
const { z } = require('zod');
const { supabase } = require('../db/supabase');
const { logger } = require('../utils/logger');
const {
  enqueuePendingBulkSites,
  getBulkDailyLimit,
  getBulkQueue,
  setBulkDailyLimit,
} = require('../services/bulk-outreach-queue');

const router = Router();

// Store file in memory — max 10 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls');
    cb(ok ? null : new Error('Only .xlsx and .xls files are accepted'), ok);
  },
});

// ── Admin secret guard ─────────────────────────────────────────────

function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  const expected = process.env.INTERNAL_API_SECRET;
  if (!secret || !expected) {
    return res.status(401).json({ error: 'Unauthorized — invalid admin secret' });
  }

  const secretBuf = Buffer.from(String(secret));
  const expectedBuf = Buffer.from(String(expected));
  if (secretBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(secretBuf, expectedBuf)) {
    return res.status(401).json({ error: 'Unauthorized — invalid admin secret' });
  }

  next();
}

// ── Helpers ────────────────────────────────────────────────────────

function normaliseUrl(raw) {
  if (!raw) return null;
  let u = String(raw).trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const parsed = new URL(u);
    // Reject obviously bad hostnames
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    return parsed.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function normaliseEmail(raw) {
  if (!raw) return null;
  const e = String(raw).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

function normaliseOptionalUrl(raw) {
  if (!raw) return null;
  const u = String(raw).trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return 'https://' + u;
}

function isMissingSchemaError(error) {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || '').toLowerCase();

  // 42P01: undefined_table, 42703: undefined_column (Postgres)
  if (code === '42P01' || code === '42703') return true;

  return (
    message.includes('bulk_import_batches') ||
    message.includes('facebook_url') ||
    message.includes('instagram_url') ||
    message.includes('import_source')
  );
}

const bulkSettingsSchema = z.object({
  dailyLimit: z.coerce.number().int().min(1).max(100),
});

/**
 * Given a worksheet, returns an array of row objects with normalised column names.
 * Handles case-insensitive and whitespace-trimmed header matching.
 */
function parseSheet(worksheet) {
  const raw = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  return raw.map((row) => {
    const normalised = {};
    for (const [k, v] of Object.entries(row)) {
      normalised[k.trim().toLowerCase().replace(/\s+/g, '_')] = v;
    }

    // Accept multiple possible spellings for each column
    const url =
      normalised.site_url ||
      normalised.url ||
      normalised.website ||
      normalised.site ||
      normalised.website_url ||
      '';
    const email =
      normalised.email ||
      normalised.email_address ||
      normalised.owner_email ||
      '';
    const facebook =
      normalised.facebook_url ||
      normalised.facebook ||
      normalised.fb ||
      '';
    const instagram =
      normalised.instagram_url ||
      normalised.instagram ||
      normalised.ig ||
      '';
    const phone =
      normalised.phone ||
      normalised.phone_number ||
      normalised.tel ||
      '';
    const name =
      normalised.name ||
      normalised.owner_name ||
      normalised.contact_name ||
      '';
    const siteName =
      normalised.site_name ||
      normalised.business_name ||
      normalised.company_name ||
      '';

    return { url, email, facebook, instagram, phone, name, siteName };
  });
}

// ── Already-contacted check ────────────────────────────────────────

async function hasBeenContacted(siteId) {
  const { count, error } = await supabase
    .from('site_contact_history')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId);
  if (error) return false;
  return (count || 0) > 0;
}

// ── POST /api/admin/bulk-import ────────────────────────────────────

router.post('/', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Send a multipart/form-data request with field name "file".' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ error: 'Excel file contains no sheets.' });
    }
    const rows = parseSheet(workbook.Sheets[sheetName]);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Excel sheet is empty or has no data rows.' });
    }

    // Create batch record
    const { data: batch, error: batchErr } = await supabase
      .from('bulk_import_batches')
      .insert({
        file_name: req.file.originalname,
        row_count: rows.length,
        status: 'processing',
      })
      .select()
      .single();

    if (batchErr) {
      if (isMissingSchemaError(batchErr)) {
        return res.status(500).json({
          error:
            'Bulk import database migration is not applied yet. Run supabase/migrations/013_bulk_import_site_columns.sql, then try upload again.',
        });
      }
      throw batchErr;
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    for (const row of rows) {
      const siteUrl = normaliseUrl(row.url);
      const ownerEmail = normaliseEmail(row.email);
      const ownerName = String(row.name || '').trim() || null;
      const preferredSiteName = String(row.siteName || '').trim() || null;

      if (!siteUrl) {
        results.skipped++;
        results.errors.push({ raw: row.url, reason: 'Invalid or missing site URL' });
        continue;
      }

      if (!ownerEmail) {
        results.skipped++;
        results.errors.push({ url: siteUrl, reason: 'Invalid or missing email' });
        continue;
      }

      try {
        // Upsert site by URL (only for import sites)
        const { data: existing } = await supabase
          .from('sites')
          .select('id, last_contacted_at')
          .eq('url', siteUrl)
          .is('user_id', null)
          .limit(1);

        let siteId;

        if (existing && existing.length > 0) {
          siteId = existing[0].id;
          // Update email + social in case they changed
          await supabase
            .from('sites')
            .update({
              owner_name: ownerName || undefined,
              name: preferredSiteName || undefined,
              owner_email: ownerEmail,
              facebook_url: normaliseOptionalUrl(row.facebook) || undefined,
              instagram_url: normaliseOptionalUrl(row.instagram) || undefined,
              phone: String(row.phone || '').trim() || undefined,
              import_source: 'excel_bulk_import',
            })
            .eq('id', siteId);
        } else {
          const { data: newSite, error: insertErr } = await supabase
            .from('sites')
            .insert({
              user_id: null,
              url: siteUrl,
              name: preferredSiteName || new URL(siteUrl).hostname,
              owner_name: ownerName,
              owner_email: ownerEmail,
              pages_to_scan: 1,
              type: 'admin',
              import_source: 'excel_bulk_import',
              facebook_url: normaliseOptionalUrl(row.facebook) || null,
              instagram_url: normaliseOptionalUrl(row.instagram) || null,
              phone: String(row.phone || '').trim() || null,
            })
            .select()
            .single();

          if (insertErr) throw insertErr;
          siteId = newSite.id;
        }

        // Skip if already contacted
        const contacted = await hasBeenContacted(siteId);
        if (contacted) {
          results.skipped++;
          logger.info('Bulk import: site already contacted, skipping queue', { siteId, siteUrl });
          continue;
        }

        results.imported++;
      } catch (rowErr) {
        results.skipped++;
        results.errors.push({ url: siteUrl, reason: rowErr.message });
        logger.error('Bulk import: row error', { siteUrl, error: rowErr.message });
      }
    }

    // Update batch status
    await supabase
      .from('bulk_import_batches')
      .update({
        imported_count: results.imported,
        skipped_count: results.skipped,
        status: 'done',
        error_details: results.errors.length > 0 ? results.errors : null,
      })
      .eq('id', batch.id);

    logger.info('Bulk import complete', {
      batchId: batch.id,
      imported: results.imported,
      skipped: results.skipped,
    });

    return res.json({
      batchId: batch.id,
      rowCount: rows.length,
      imported: results.imported,
      skipped: results.skipped,
      errors: results.errors,
      message: `Imported ${results.imported} sites. ${results.skipped} skipped. They are now pending for daily processing or Run Now from admin.`,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/settings', requireAdmin, async (_req, res, next) => {
  try {
    const dailyLimit = await getBulkDailyLimit();
    return res.json({ dailyLimit });
  } catch (err) {
    next(err);
  }
});

router.patch('/settings', requireAdmin, async (req, res, next) => {
  try {
    const parsed = bulkSettingsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const dailyLimit = await setBulkDailyLimit(parsed.data.dailyLimit);
    return res.json({ dailyLimit, message: 'Daily sites limit updated.' });
  } catch (err) {
    next(err);
  }
});

router.post('/run-now', requireAdmin, async (req, res, next) => {
  try {
    const parsed = bulkSettingsSchema.partial().safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const dailyLimit = parsed.data.dailyLimit || await getBulkDailyLimit();
    const outcome = await enqueuePendingBulkSites(dailyLimit);
    return res.json({
      ...outcome,
      message: `Queued ${outcome.enqueued} site(s) to scan and send email now.`,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/bulk-import/batches ────────────────────────────

router.get('/batches', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const { data, error } = await supabase
      .from('bulk_import_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return res.json({ batches: data || [] });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/bulk-import/queue-status ───────────────────────

router.get('/queue-status', requireAdmin, async (req, res, next) => {
  try {
    const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Count pending bulk sites using the same rule as the scheduler / Run Now.
    const { count: pendingCount } = await supabase
      .from('sites')
      .select('id', { count: 'exact', head: true })
      .eq('import_source', 'excel_bulk_import')
      .or(`last_contacted_at.is.null,last_contacted_at.lt.${threshold}`)
      .not('owner_email', 'is', null);

    const queue = getBulkQueue();
    let activeJobs = 0;
    let waitingJobs = 0;
    if (queue) {
      activeJobs = await queue.getActiveCount();
      waitingJobs = await queue.getWaitingCount();
    }

    const dailyLimit = await getBulkDailyLimit();

    return res.json({
      pendingSites: pendingCount || 0,
      activeJobs,
      waitingJobs,
      dailyLimit,
      queueAvailable: !!queue,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = { bulkImportRoutes: router };
