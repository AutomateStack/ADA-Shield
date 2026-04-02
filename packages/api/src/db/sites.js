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

    // Look up emails from the public profiles table instead.
    // Gracefully skip if the table doesn't exist yet (migration not yet run).
    const userIds = [...new Set(sites.map((s) => s.user_id).filter(Boolean))];
    let emailMap = {};
    if (userIds.length === 0) {
      return sites.map((site) => ({ ...site, users: { email: null } }));
    }
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      if (!profilesError && profiles) {
        for (const p of profiles) emailMap[p.id] = p.email;
      } else if (profilesError) {
        logger.warn('Could not fetch profiles for weekly scan emails — proceeding without emails', {
          error: profilesError.message,
        });
      }
    } catch (profileErr) {
      logger.warn('profiles table query failed — proceeding without emails', {
        error: profileErr.message,
      });
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
 * Creates or finds a free scan site (user_id = null) and optionally updates owner/sales metadata.
 * Used during free scans to track site metadata for admin outreach.
 * @param {object} params
 * @param {string} params.url - Site URL.
 * @param {string} [params.ownerName] - Extracted owner/company name.
 * @param {string} [params.ownerEmail] - Extracted contact email.
 * @returns {Promise<object>} The site row.
 */
async function createOrUpdateFreeScanSite({ url, ownerName, ownerEmail, type = 'free' }) {
  try {
    // Try to find existing free scan site by URL
    const { data: existing } = await supabase
      .from('sites')
      .select('id')
      .eq('url', url)
      .is('user_id', null)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing free scan site with metadata if provided
      if (ownerName || ownerEmail) {
        const updateData = {};
        if (ownerName) updateData.owner_name = ownerName;
        if (ownerEmail) updateData.owner_email = ownerEmail;

        const { data, error } = await supabase
          .from('sites')
          .update(updateData)
          .eq('id', existing[0].id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
      return existing[0];
    }

    // Create new free scan site
    const siteData = {
      user_id: null,
      url,
      name: new URL(url).hostname,
      owner_name: ownerName || null,
      owner_email: ownerEmail || null,
      pages_to_scan: 1,
      type,
    };

    const { data, error } = await supabase
      .from('sites')
      .insert(siteData)
      .select()
      .single();

    if (error) throw error;
    logger.info('Free scan site created', { id: data.id, url, type });
    return data;
  } catch (error) {
    logger.error('Failed to create/update free scan site', { url, error: error.message });
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
  createOrUpdateFreeScanSite,
  deleteSite,
};
