const { supabase } = require('./supabase');
const { logger } = require('../utils/logger');

/**
 * Creates a new site for a user.
 * @param {object} params
 * @param {string} params.userId - User UUID.
 * @param {string} params.url - Site URL.
 * @param {string} [params.name] - Friendly name.
 * @param {number} [params.pagesToScan=10] - Number of pages to scan.
 * @returns {Promise<object>} The created site row.
 */
async function createSite({ userId, url, name, pagesToScan = 10 }) {
  try {
    const { data, error } = await supabase
      .from('sites')
      .insert({
        user_id: userId,
        url,
        name: name || new URL(url).hostname,
        pages_to_scan: pagesToScan,
      })
      .select()
      .single();

    if (error) throw error;
    logger.info('Site created', { id: data.id, url });
    return data;
  } catch (error) {
    logger.error('Failed to create site', { url, error: error.message });
    throw error;
  }
}

/**
 * Gets all sites for a user.
 * @param {string} userId - User UUID.
 * @returns {Promise<Array>} Array of site rows.
 */
async function getUserSites(userId) {
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Failed to get user sites', {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Gets a single site by ID.
 * @param {string} siteId - Site UUID.
 * @returns {Promise<object|null>} Site row or null.
 */
async function getSiteById(siteId) {
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    logger.error('Failed to get site', { siteId, error: error.message });
    throw error;
  }
}

/**
 * Gets a single site by ID, scoped to the given user (ownership check).
 * @param {string} siteId - Site UUID.
 * @param {string} userId - User UUID.
 * @returns {Promise<object|null>} Site row or null if not found / not owned by user.
 */
async function getUserSiteById(siteId, userId) {
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    logger.error('Failed to get site by id for user', { siteId, userId, error: error.message });
    throw error;
  }
}

/**
 * Gets all sites where monitoring is active (for weekly scans).
 * @returns {Promise<Array>} Array of site rows with active monitoring.
 */
async function getMonitoredSites() {
  try {
    // Fetch sites without joining auth.users (different schema — PostgREST can't resolve it)
    const { data: sites, error } = await supabase
      .from('sites')
      .select('*')
      .eq('monitoring_active', true);

    if (error) throw error;
    if (!sites || sites.length === 0) return [];

    // Look up emails from the public profiles table instead
    const userIds = [...new Set(sites.map((s) => s.user_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    const emailMap = {};
    if (profiles) {
      for (const p of profiles) emailMap[p.id] = p.email;
    }

    // Attach user email as site.users.email (keeps existing callers compatible)
    return sites.map((site) => ({
      ...site,
      users: { email: emailMap[site.user_id] || null },
    }));
  } catch (error) {
    logger.error('Failed to get monitored sites', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Deletes a site and its associated scan results (via CASCADE).
 * @param {string} siteId - Site UUID.
 */
async function deleteSite(siteId) {
  try {
    const { error } = await supabase.from('sites').delete().eq('id', siteId);
    if (error) throw error;
    logger.info('Site deleted', { siteId });
  } catch (error) {
    logger.error('Failed to delete site', { siteId, error: error.message });
    throw error;
  }
}

module.exports = {
  createSite,
  getUserSites,
  getSiteById,
  getUserSiteById,
  getMonitoredSites,
  deleteSite,
};
