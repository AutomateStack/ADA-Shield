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

    // Average risk score
    const { data: avgData } = await supabase
      .from('scan_results')
      .select('risk_score');
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
    const { data, error } = await supabase
      .from('scan_results')
      .select('url');

    if (error) throw error;

    // Aggregate by URL in JS
    const counts = {};
    for (const row of (data || [])) {
      const hostname = new URL(row.url).hostname;
      counts[hostname] = (counts[hostname] || 0) + 1;
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

    // Enrich each user with site + scan counts
    const enriched = await Promise.all(
      (users || []).map(async (user) => {
        const [
          { count: siteCount },
          { count: scanCount },
        ] = await Promise.all([
          supabase.from('sites').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('scan_results').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        ]);

        // Get subscription
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('plan, status')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        return {
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
          lastSignIn: user.last_sign_in_at,
          siteCount: siteCount || 0,
          scanCount: scanCount || 0,
          plan: sub?.plan || 'free',
          subscriptionStatus: sub?.status || null,
        };
      })
    );

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

module.exports = {
  getAdminStats,
  getAdminScans,
  getTopScannedUrls,
  getAdminUsers,
  getAdminSubscriptions,
  getAdminScanDetail,
};
