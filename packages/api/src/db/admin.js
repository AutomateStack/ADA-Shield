const { supabase } = require('./supabase');
const { logger } = require('../utils/logger');

// ── Overview Stats ──────────────────────────────────────────────────

/**
 * Returns aggregate stats for the admin overview dashboard.
 */
async function getAdminStats() {
  try {
    const [
      { count: totalScans },
      { count: totalSites },
      { count: totalSubscriptions },
    ] = await Promise.all([
      supabase.from('scan_results').select('*', { count: 'exact', head: true }),
      supabase.from('sites').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    // Free scans = scans with no user_id
    const { count: freeScans } = await supabase
      .from('scan_results')
      .select('*', { count: 'exact', head: true })
      .is('user_id', null);

    // Scans in last 24 hours
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: scansLast24h } = await supabase
      .from('scan_results')
      .select('*', { count: 'exact', head: true })
      .gte('scanned_at', since24h);

    // Scans in last 7 days
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: scansLast7d } = await supabase
      .from('scan_results')
      .select('*', { count: 'exact', head: true })
      .gte('scanned_at', since7d);

    // Average risk score — use limited sample for performance instead of fetching all rows
    const { data: avgData } = await supabase
      .from('scan_results')
      .select('risk_score')
      .not('risk_score', 'is', null)
      .order('scanned_at', { ascending: false })
      .limit(1000);
    const avgRiskScore = avgData && avgData.length > 0
      ? Math.round(avgData.reduce((sum, r) => sum + (r.risk_score || 0), 0) / avgData.length)
      : 0;

    return {
      totalScans: totalScans || 0,
      freeScans: freeScans || 0,
      authenticatedScans: (totalScans || 0) - (freeScans || 0),
      scansLast24h: scansLast24h || 0,
      scansLast7d: scansLast7d || 0,
      totalSites: totalSites || 0,
      activeSubscriptions: totalSubscriptions || 0,
      avgRiskScore,
    };
  } catch (error) {
    logger.error('Failed to get admin stats', { error: error.message });
    throw error;
  }
}

// ── Scan Listings ───────────────────────────────────────────────────

/**
 * Returns recent scans with pagination.
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.type] - 'free' | 'authenticated' | undefined for all
 */
async function getAdminScans({ page = 1, limit = 20, type } = {}) {
  try {
    let query = supabase
      .from('scan_results')
      .select('id, url, scanned_at, risk_score, total_violations, critical_count, serious_count, moderate_count, minor_count, scan_duration_ms, user_id, site_id', { count: 'exact' })
      .order('scanned_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (type === 'free') {
      query = query.is('user_id', null);
    } else if (type === 'authenticated') {
      query = query.not('user_id', 'is', null);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      scans: data || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    };
  } catch (error) {
    logger.error('Failed to get admin scans', { error: error.message });
    throw error;
  }
}

// ── Top Scanned URLs ────────────────────────────────────────────────

/**
 * Returns the most frequently scanned URLs.
 * @param {number} [limit=10]
 */
async function getTopScannedUrls(limit = 10) {
  try {
    // Fetch only recent URLs (last 10k) to avoid loading entire table into memory
    const { data, error } = await supabase
      .from('scan_results')
      .select('url')
      .order('scanned_at', { ascending: false })
      .limit(10000);

    if (error) throw error;

    // Aggregate by hostname in JS
    const counts = {};
    for (const row of (data || [])) {
      try {
        const hostname = new URL(row.url).hostname;
        counts[hostname] = (counts[hostname] || 0) + 1;
      } catch {
        // Skip malformed URLs
      }
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([hostname, count]) => ({ hostname, scanCount: count }));
  } catch (error) {
    logger.error('Failed to get top scanned URLs', { error: error.message });
    throw error;
  }
}

// ── User Listings ───────────────────────────────────────────────────

/**
 * Returns registered users with their site count and scan count.
 * Queries auth.users via admin API.
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 */
async function getAdminUsers({ page = 1, limit = 20 } = {}) {
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: limit,
    });

    if (error) throw error;

    // Batch-fetch all enrichment data for the user IDs in one go (avoids N+1)
    const userIds = (users || []).map((u) => u.id);

    const [siteCounts, scanCounts, subscriptions] = await Promise.all([
      // Batch site counts
      supabase
        .from('sites')
        .select('user_id')
        .in('user_id', userIds),
      // Batch scan counts
      supabase
        .from('scan_results')
        .select('user_id')
        .in('user_id', userIds),
      // Batch subscriptions
      supabase
        .from('subscriptions')
        .select('user_id, plan, status')
        .in('user_id', userIds),
    ]);

    // Build lookup maps
    const siteCountMap = {};
    for (const row of (siteCounts.data || [])) {
      siteCountMap[row.user_id] = (siteCountMap[row.user_id] || 0) + 1;
    }
    const scanCountMap = {};
    for (const row of (scanCounts.data || [])) {
      scanCountMap[row.user_id] = (scanCountMap[row.user_id] || 0) + 1;
    }
    const subMap = {};
    for (const row of (subscriptions.data || [])) {
      if (!subMap[row.user_id]) subMap[row.user_id] = row;
    }

    const enriched = (users || []).map((user) => {
      const sub = subMap[user.id];
      return {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at,
        siteCount: siteCountMap[user.id] || 0,
        scanCount: scanCountMap[user.id] || 0,
        plan: sub?.plan || 'free',
        subscriptionStatus: sub?.status || null,
      };
    });

    return {
      users: enriched,
      page,
    };
  } catch (error) {
    logger.error('Failed to get admin users', { error: error.message });
    throw error;
  }
}

// ── Subscription Listings ───────────────────────────────────────────

/**
 * Returns all subscriptions with user email.
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 */
async function getAdminSubscriptions({ page = 1, limit = 20 } = {}) {
  try {
    const { data, error, count } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    return {
      subscriptions: data || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    };
  } catch (error) {
    logger.error('Failed to get admin subscriptions', { error: error.message });
    throw error;
  }
}

// ── Scan Detail with Violations ─────────────────────────────────────

/**
 * Returns full scan detail including violations JSONB.
 * @param {string} scanId
 */
async function getAdminScanDetail(scanId) {
  try {
    const { data, error } = await supabase
      .from('scan_results')
      .select('*')
      .eq('id', scanId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Failed to get admin scan detail', { error: error.message });
    throw error;
  }
}

// ── Sites Listings / Metadata ──────────────────────────────────────

/**
 * Returns sites with pagination plus owner email lookup.
 * Includes both authenticated user sites and free-scan sites (user_id = null).
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.type] - Filter by type: 'free' | 'admin' | 'registered'
 * @param {boolean} [params.contracted] - Filter by contracted (contacted_count > 0)
 * @param {string} [params.risk] - Filter by latest risk: 'high' | 'medium' | 'low' | 'unscanned'
 */
async function getAdminSites({ page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', type, contracted, risk } = {}) {
  try {
    const allowedSortBy = new Set(['created_at', 'contacted_count', 'last_contacted_at']);
    const normalizedSortBy = allowedSortBy.has(sortBy) ? sortBy : 'created_at';
    const normalizedSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    let filteredSiteIdsByRisk = null;
    if (risk && ['high', 'medium', 'low', 'unscanned'].includes(risk)) {
      const { data: allScans, error: allScansError } = await supabase
        .from('scan_results')
        .select('site_id, risk_score, scanned_at')
        .order('scanned_at', { ascending: false });

      if (allScansError) throw allScansError;

      const latestRiskBySiteId = {};
      for (const scan of allScans || []) {
        if (scan.site_id && !Object.prototype.hasOwnProperty.call(latestRiskBySiteId, scan.site_id)) {
          latestRiskBySiteId[scan.site_id] = scan.risk_score;
        }
      }

      if (risk === 'unscanned') {
        const { data: allSitesOnly, error: allSitesError } = await supabase
          .from('sites')
          .select('id');
        if (allSitesError) throw allSitesError;

        filteredSiteIdsByRisk = (allSitesOnly || [])
          .map((s) => s.id)
          .filter((siteId) => !Object.prototype.hasOwnProperty.call(latestRiskBySiteId, siteId));
      } else {
        filteredSiteIdsByRisk = Object.keys(latestRiskBySiteId).filter((siteId) => {
          const score = latestRiskBySiteId[siteId];
          if (!Number.isFinite(score)) return false;
          if (risk === 'high') return score >= 70;
          if (risk === 'medium') return score >= 40 && score < 70;
          return score < 40;
        });
      }
    }

    let query = supabase
      .from('sites')
      .select(
        'id, user_id, url, name, created_at, owner_name, owner_email, notification_recipients, contacted_count, last_contacted_at, type',
        { count: 'exact' }
      );

    if (filteredSiteIdsByRisk) {
      if (filteredSiteIdsByRisk.length === 0) {
        return {
          sites: [],
          total: 0,
          page,
          totalPages: 0,
        };
      }
      query = query.in('id', filteredSiteIdsByRisk);
    }

    // Apply type filter if provided
    if (type && ['free', 'admin', 'registered'].includes(type)) {
      query = query.eq('type', type);
    }

    // Apply contracted filter if provided
    if (contracted === true) {
      query = query.gt('contacted_count', 0);
    } else if (contracted === false) {
      query = query.eq('contacted_count', 0);
    }

    const { data, error, count } = await query
      .order(normalizedSortBy, { ascending: normalizedSortOrder === 'asc', nullsFirst: normalizedSortOrder !== 'asc' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    const sites = data || [];
    const siteIds = sites.map((s) => s.id).filter(Boolean);
    const authenticatedUserIds = [...new Set(sites.map((s) => s.user_id).filter(Boolean))];
    let emailMap = {};
    const latestRiskBySiteId = {};
    const latestScannedAtBySiteId = {};

    if (siteIds.length > 0) {
      const { data: siteScans, error: scansError } = await supabase
        .from('scan_results')
        .select('site_id, risk_score, scanned_at')
        .in('site_id', siteIds)
        .order('scanned_at', { ascending: false });

      if (scansError) {
        logger.warn('Could not fetch latest scan risk for admin sites view', { error: scansError.message });
      } else {
        for (const scan of siteScans || []) {
          if (!latestRiskBySiteId[scan.site_id]) {
            latestRiskBySiteId[scan.site_id] = scan.risk_score;
            latestScannedAtBySiteId[scan.site_id] = scan.scanned_at;
          }
        }
      }
    }

    if (authenticatedUserIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', authenticatedUserIds);
      if (profilesError) {
        logger.warn('Could not fetch profiles for admin sites view', { error: profilesError.message });
      } else {
        for (const p of profiles || []) {
          emailMap[p.id] = p.email;
        }
      }
    }

    return {
      sites: sites.map((site) => ({
        ...site,
        user_email: site.user_id ? emailMap[site.user_id] || null : null,
        is_registered: !!site.user_id,
        latest_risk_score: Object.prototype.hasOwnProperty.call(latestRiskBySiteId, site.id)
          ? latestRiskBySiteId[site.id]
          : null,
        latest_scanned_at: latestScannedAtBySiteId[site.id] || null,
      })),
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    };
  } catch (error) {
    logger.error('Failed to get admin sites', { error: error.message });
    throw error;
  }
}

/**
 * Updates site-level owner metadata from admin panel.
 * @param {string} siteId
 * @param {object} patch - Fields to update (owner_name, owner_email, notification_recipients)
 */
async function updateAdminSiteMetadata(siteId, patch) {
  try {
    const { data, error } = await supabase
      .from('sites')
      .update(patch)
      .eq('id', siteId)
      .select(
        'id, user_id, url, name, created_at, owner_name, owner_email, notification_recipients, contacted_count, last_contacted_at, type'
      )
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Failed to update admin site metadata', { siteId, error: error.message });
    throw error;
  }
}

/**
 * Get a site by ID.
 * @param {string} siteId
 */
async function getSiteById(siteId) {
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('id, url, name, owner_name, owner_email, notification_recipients, user_id, created_at, contacted_count, last_contacted_at, type')
      .eq('id', siteId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    logger.error('Failed to get site by ID', { siteId, error: error.message });
    throw error;
  }
}

/**
 * Get latest scan summary for a site.
 * @param {string} siteId
 */
async function getLatestSiteScanSummary(siteId) {
  try {
    const { data, error } = await supabase
      .from('scan_results')
      .select('id, scanned_at, total_violations, critical_count, serious_count, risk_score')
      .eq('site_id', siteId)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    logger.error('Failed to get latest site scan summary', { siteId, error: error.message });
    throw error;
  }
}

/**
 * Marks a site as contacted and increments contact count.
 * @param {string} siteId
 */
async function markSiteAsContacted(siteId) {
  try {
    // Fetch current count first (supabase-js v2 has no raw() increment)
    const { data: current, error: fetchError } = await supabase
      .from('sites')
      .select('contacted_count')
      .eq('id', siteId)
      .single();
    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('sites')
      .update({
        contacted_count: (current?.contacted_count || 0) + 1,
        last_contacted_at: new Date().toISOString(),
      })
      .eq('id', siteId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Failed to mark site as contacted', { siteId, error: error.message });
    throw error;
  }
}

/**
 * Inserts a contact history row for site outreach email.
 * @param {object} params
 */
async function createSiteContactHistoryEntry({
  siteId,
  recipientEmail,
  subject,
  message,
  templateStyle,
  deliveryChannel,
  deliveryStatus = 'sent',
  providerMessageId = null,
}) {
  try {
    const { data, error } = await supabase
      .from('site_contact_history')
      .insert({
        site_id: siteId,
        recipient_email: recipientEmail,
        subject,
        message,
        template_style: templateStyle || null,
        delivery_channel: deliveryChannel || null,
        delivery_status: deliveryStatus,
        provider_message_id: providerMessageId,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Failed to create site contact history entry', {
      siteId,
      recipientEmail,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Returns contact history rows for a site.
 * @param {string} siteId
 * @param {object} params
 */
async function getSiteContactHistory(siteId, { page = 1, limit = 20 } = {}) {
  try {
    const { data, error, count } = await supabase
      .from('site_contact_history')
      .select('*', { count: 'exact' })
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;
    return {
      entries: data || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    };
  } catch (error) {
    logger.error('Failed to get site contact history', { siteId, error: error.message });
    throw error;
  }
}

module.exports = {
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
};
