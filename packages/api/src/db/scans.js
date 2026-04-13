const { supabase } = require('./supabase');
const { logger } = require('../utils/logger');

/**
 * Saves a scan result to the scan_results table.
 * @param {object} result - The processed scan result.
 * @param {string} result.url - The scanned URL.
 * @param {string} [result.siteId] - The associated site ID.
 * @param {string} [result.userId] - The user ID.
 * @param {number} result.riskScore - Calculated risk score 0-100.
 * @param {number} result.totalViolations - Total violations found.
 * @param {number} result.criticalCount - Critical violations.
 * @param {number} result.seriousCount - Serious violations.
 * @param {number} result.moderateCount - Moderate violations.
 * @param {number} result.minorCount - Minor violations.
 * @param {Array} result.violations - Full violation detail array.
 * @param {number} result.passedRules - Number of rules passed.
 * @param {number} result.incompleteRules - Number of incomplete rules.
 * @param {string} [result.jobId] - BullMQ job ID.
 * @param {number} result.scanDurationMs - Duration in milliseconds.
 * @returns {Promise<object>} The saved scan result row.
 */
async function saveScanResult(result) {
  try {
    const { data, error } = await supabase
      .from('scan_results')
      .insert({
        site_id: result.siteId || null,
        user_id: result.userId || null,
        url: result.url,
        risk_score: result.riskScore,
        total_violations: result.totalViolations,
        critical_count: result.criticalCount,
        serious_count: result.seriousCount,
        moderate_count: result.moderateCount,
        minor_count: result.minorCount,
        violations: result.violations,
        passed_rules: result.passedRules,
        incomplete_rules: result.incompleteRules,
        job_id: result.jobId || null,
        scan_duration_ms: result.scanDurationMs,
        public_token: result.publicToken || undefined,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Scan result saved', { id: data.id, url: result.url });
    return data;
  } catch (error) {
    logger.error('Failed to save scan result', {
      url: result.url,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Retrieves scan results for a specific site, ordered by most recent.
 * @param {string} siteId - The site UUID.
 * @param {number} [limit=10] - Max results to return.
 * @returns {Promise<Array>} Array of scan result rows.
 */
async function getScanResults(siteId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('scan_results')
      .select('*')
      .eq('site_id', siteId)
      .order('scanned_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Failed to get scan results', {
      siteId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Gets the latest scan result for a site.
 * @param {string} siteId - The site UUID.
 * @returns {Promise<object|null>} The latest scan result or null.
 */
async function getLatestScanResult(siteId) {
  try {
    const { data, error } = await supabase
      .from('scan_results')
      .select('*')
      .eq('site_id', siteId)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    logger.error('Failed to get latest scan result', {
      siteId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Gets a single scan result by ID.
 * @param {string} scanId - The scan result UUID.
 * @returns {Promise<object|null>} The scan result or null.
 */
async function getScanById(scanId) {
  try {
    const { data, error } = await supabase
      .from('scan_results')
      .select('*')
      .eq('id', scanId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    logger.error('Failed to get scan by ID', {
      scanId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Updates the last_scanned_at timestamp for a site.
 * @param {string} siteId - The site UUID.
 */
async function updateSiteLastScanned(siteId) {
  try {
    const { error } = await supabase
      .from('sites')
      .update({ last_scanned_at: new Date().toISOString() })
      .eq('id', siteId);

    if (error) throw error;
  } catch (error) {
    logger.error('Failed to update site last_scanned_at', {
      siteId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Gets a scan result by its public token (no auth required).
 * Used for shareable public report links.
 * @param {string} token - The public UUID token.
 * @returns {Promise<object|null>} The scan result (without sensitive user data) or null.
 */
async function getPublicScanByToken(token) {
  try {
    const { data, error } = await supabase
      .from('scan_results')
      .select(
        'id, url, scanned_at, risk_score, total_violations, critical_count, serious_count, moderate_count, minor_count, violations, passed_rules, incomplete_rules, scan_duration_ms, public_token'
      )
      .eq('public_token', token)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    logger.error('Failed to get public scan by token', { token, error: error.message });
    throw error;
  }
}

module.exports = {
  saveScanResult,
  getScanResults,
  getLatestScanResult,
  getScanById,
  updateSiteLastScanned,
  getPublicScanByToken,
};
