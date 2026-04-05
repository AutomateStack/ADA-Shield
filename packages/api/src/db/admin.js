const { supabase } = require('./supabase');
const { logger } = require('../utils/logger');
const { calculateLeadScore, getLeadStatus } = require('../services/outreach-tracking');

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
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const { data, error } = await supabase.rpc('get_top_scanned_urls', {
      limit_count: safeLimit,
    });
    if (error) throw error;

    return (data || []).map((row) => ({
      hostname: row.hostname,
      scanCount: row.scan_count,
    }));
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
 * @param {string} [params.scannedFrom] - ISO timestamp lower bound for latest scan date
 * @param {string} [params.scannedTo] - ISO timestamp upper bound for latest scan date
 */
async function getAdminSites({
  page = 1,
  limit = 20,
  sortBy = 'created_at',
  sortOrder = 'desc',
  type,
  contracted,
  risk,
  scannedFrom,
  scannedTo,
} = {}) {
  try {
    const allowedSortBy = new Set(['created_at', 'contacted_count', 'last_contacted_at']);
    const normalizedSortBy = allowedSortBy.has(sortBy) ? sortBy : 'created_at';
    const normalizedSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    let filteredSiteIdsByRisk = null;
    let filteredSiteIdsByScanDate = null;
    let latestBySiteMap = {};
    const shouldFilterByScanDate = Boolean(scannedFrom || scannedTo);
    const shouldFilterByRisk = Boolean(risk && ['high', 'medium', 'low', 'unscanned'].includes(risk));

    if (shouldFilterByRisk || shouldFilterByScanDate) {
      const { data: latestBySite, error: latestBySiteError } = await supabase.rpc('get_latest_scan_per_site', {
        site_ids: null,
      });
      if (latestBySiteError) throw latestBySiteError;

      latestBySiteMap = (latestBySite || []).reduce((acc, row) => {
        if (row?.site_id) acc[row.site_id] = row;
        return acc;
      }, {});

      if (shouldFilterByScanDate) {
        filteredSiteIdsByScanDate = Object.keys(latestBySiteMap).filter((siteId) => {
          const scannedAt = latestBySiteMap[siteId]?.scanned_at;
          if (!scannedAt) return false;
          if (scannedFrom && scannedAt < scannedFrom) return false;
          if (scannedTo && scannedAt > scannedTo) return false;
          return true;
        });
      }

      if (risk === 'unscanned') {
        const { data: allSitesOnly, error: allSitesError } = await supabase
          .from('sites')
          .select('id');
        if (allSitesError) throw allSitesError;

        filteredSiteIdsByRisk = (allSitesOnly || [])
          .map((s) => s.id)
          .filter((siteId) => !Object.prototype.hasOwnProperty.call(latestBySiteMap, siteId));
      } else if (shouldFilterByRisk) {
        filteredSiteIdsByRisk = Object.keys(latestBySiteMap).filter((siteId) => {
          const score = latestBySiteMap[siteId]?.risk_score;
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

    if (filteredSiteIdsByScanDate) {
      if (filteredSiteIdsByScanDate.length === 0) {
        return {
          sites: [],
          total: 0,
          page,
          totalPages: 0,
        };
      }
      query = query.in('id', filteredSiteIdsByScanDate);
    }

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
      const { data: latestForPage, error: latestForPageError } = await supabase.rpc('get_latest_scan_per_site', {
        site_ids: siteIds,
      });

      if (latestForPageError) {
        logger.warn('Could not fetch latest scan risk for admin sites view', { error: latestForPageError.message });
      } else {
        for (const row of latestForPage || []) {
          if (row.site_id) {
            latestRiskBySiteId[row.site_id] = row.risk_score;
            latestScannedAtBySiteId[row.site_id] = row.scanned_at;
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
      .select('id, public_token, scanned_at, total_violations, critical_count, serious_count, risk_score, violations')
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
  sendBatchId = null,
  parentContactHistoryId = null,
  scanId = null,
  reportUrl = null,
  trackedReportUrl = null,
  trackingPixelUrl = null,
  automationEnabled = true,
  followUpStatus = 'none',
  followUpRule = null,
  followUpScheduledFor = null,
  followUpAttempts = 0,
  trackingToken = null,
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
        send_batch_id: sendBatchId,
        parent_contact_history_id: parentContactHistoryId,
        scan_id: scanId,
        report_url: reportUrl,
        tracked_report_url: trackedReportUrl,
        tracking_pixel_url: trackingPixelUrl,
        automation_enabled: automationEnabled,
        follow_up_status: followUpStatus,
        follow_up_rule: followUpRule,
        follow_up_scheduled_for: followUpScheduledFor,
        follow_up_attempts: followUpAttempts,
        tracking_token: trackingToken,
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

async function updateSiteContactHistoryEntry(contactHistoryId, patch) {
  try {
    const { data, error } = await supabase
      .from('site_contact_history')
      .update(patch)
      .eq('id', contactHistoryId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Failed to update site contact history entry', {
      contactHistoryId,
      error: error.message,
    });
    throw error;
  }
}

async function getSiteContactHistoryEntryById(contactHistoryId) {
  try {
    const { data, error } = await supabase
      .from('site_contact_history')
      .select('*')
      .eq('id', contactHistoryId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    logger.error('Failed to get site contact history entry by ID', {
      contactHistoryId,
      error: error.message,
    });
    throw error;
  }
}

async function getSiteContactHistoryEntryByTrackingToken(trackingToken) {
  try {
    const { data, error } = await supabase
      .from('site_contact_history')
      .select('*')
      .eq('tracking_token', trackingToken)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    logger.error('Failed to get site contact history entry by tracking token', {
      trackingToken,
      error: error.message,
    });
    throw error;
  }
}

async function createSiteContactEvent({
  siteId,
  contactHistoryId,
  eventType,
  url = null,
  metadata = {},
  userAgent = null,
  ipAddressHash = null,
}) {
  try {
    const { data, error } = await supabase
      .from('site_contact_events')
      .insert({
        site_id: siteId,
        contact_history_id: contactHistoryId,
        event_type: eventType,
        url,
        metadata: metadata || {},
        user_agent: userAgent,
        ip_address_hash: ipAddressHash,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Failed to create site contact event', {
      siteId,
      contactHistoryId,
      eventType,
      error: error.message,
    });
    throw error;
  }
}

async function recordSiteContactEngagement({
  trackingToken,
  eventType,
  url = null,
  metadata = {},
  userAgent = null,
  ipAddressHash = null,
}) {
  const contact = await getSiteContactHistoryEntryByTrackingToken(trackingToken);
  if (!contact) return null;

  const now = new Date().toISOString();
  const nextContact = {
    ...contact,
    last_engagement_at: now,
    last_event_type: eventType,
  };

  if (eventType === 'open') {
    nextContact.opens_count = Number(contact.opens_count || 0) + 1;
    nextContact.first_opened_at = contact.first_opened_at || now;
    nextContact.last_opened_at = now;
  }

  if (eventType === 'click') {
    nextContact.clicks_count = Number(contact.clicks_count || 0) + 1;
    nextContact.first_clicked_at = contact.first_clicked_at || now;
    nextContact.last_clicked_at = now;
    nextContact.last_clicked_url = url || contact.last_clicked_url || null;
  }

  nextContact.lead_score = calculateLeadScore(nextContact);
  nextContact.lead_status = getLeadStatus(nextContact.lead_score);

  await createSiteContactEvent({
    siteId: contact.site_id,
    contactHistoryId: contact.id,
    eventType,
    url,
    metadata,
    userAgent,
    ipAddressHash,
  });

  return updateSiteContactHistoryEntry(contact.id, {
    opens_count: nextContact.opens_count,
    clicks_count: nextContact.clicks_count,
    first_opened_at: nextContact.first_opened_at,
    last_opened_at: nextContact.last_opened_at,
    first_clicked_at: nextContact.first_clicked_at,
    last_clicked_at: nextContact.last_clicked_at,
    last_clicked_url: nextContact.last_clicked_url,
    last_engagement_at: nextContact.last_engagement_at,
    last_event_type: nextContact.last_event_type,
    lead_score: nextContact.lead_score,
    lead_status: nextContact.lead_status,
  });
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

async function getSiteContactEvents(siteId, { limit = 50 } = {}) {
  try {
    const { data, error } = await supabase
      .from('site_contact_events')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Failed to get site contact events', { siteId, error: error.message });
    throw error;
  }
}

function summarizeContactEntries(entries) {
  const sentCount = entries.filter((entry) => entry.delivery_status === 'sent').length;
  const openedCount = entries.filter((entry) => Number(entry.opens_count || 0) > 0).length;
  const clickedCount = entries.filter((entry) => Number(entry.clicks_count || 0) > 0).length;
  const hotLeadCount = entries.filter((entry) => entry.lead_status === 'hot').length;
  const followUpsScheduled = entries.filter((entry) => entry.follow_up_status === 'scheduled').length;

  return {
    sentCount,
    openedCount,
    clickedCount,
    openRate: sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0,
    clickRate: sentCount > 0 ? Math.round((clickedCount / sentCount) * 100) : 0,
    hotLeadCount,
    followUpsScheduled,
  };
}

async function getSiteOutreachAnalytics(siteId) {
  try {
    const [site, history, events] = await Promise.all([
      getSiteById(siteId),
      supabase
        .from('site_contact_history')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false }),
      supabase
        .from('site_contact_events')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (history.error) throw history.error;
    if (events.error) throw events.error;

    const entries = history.data || [];
    const summary = summarizeContactEntries(entries);
    const topLead = [...entries].sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))[0] || null;

    return {
      site,
      summary: {
        ...summary,
        topLeadScore: topLead?.lead_score || 0,
        topLeadStatus: topLead?.lead_status || 'cold',
        lastEngagementAt: topLead?.last_engagement_at || null,
      },
      entries,
      events: events.data || [],
    };
  } catch (error) {
    logger.error('Failed to get site outreach analytics', { siteId, error: error.message });
    throw error;
  }
}

async function getOutreachOverview({ limit = 10 } = {}) {
  try {
    const [historyResult, eventsResult] = await Promise.all([
      supabase
        .from('site_contact_history')
        .select('id, site_id, recipient_email, subject, delivery_status, created_at, opens_count, clicks_count, lead_score, lead_status, follow_up_status, follow_up_scheduled_for, last_engagement_at, sites(name, url)')
        .order('created_at', { ascending: false })
        .limit(250),
      supabase
        .from('site_contact_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    if (historyResult.error) throw historyResult.error;
    if (eventsResult.error) throw eventsResult.error;

    const entries = historyResult.data || [];
    const summary = summarizeContactEntries(entries);
    const topLeads = [...entries]
      .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
      .slice(0, limit)
      .map((entry) => ({
        id: entry.id,
        siteId: entry.site_id,
        recipientEmail: entry.recipient_email,
        subject: entry.subject,
        leadScore: entry.lead_score,
        leadStatus: entry.lead_status,
        opensCount: entry.opens_count,
        clicksCount: entry.clicks_count,
        lastEngagementAt: entry.last_engagement_at,
        followUpStatus: entry.follow_up_status,
        followUpScheduledFor: entry.follow_up_scheduled_for,
        siteName: entry.sites?.name || null,
        siteUrl: entry.sites?.url || null,
      }));

    return {
      summary,
      topLeads,
      recentEvents: eventsResult.data || [],
    };
  } catch (error) {
    logger.error('Failed to get outreach overview', { error: error.message });
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
  updateSiteContactHistoryEntry,
  getSiteContactHistoryEntryById,
  getSiteContactHistoryEntryByTrackingToken,
  createSiteContactEvent,
  recordSiteContactEngagement,
  getSiteContactHistory,
  getSiteContactEvents,
  getSiteOutreachAnalytics,
  getOutreachOverview,
};
