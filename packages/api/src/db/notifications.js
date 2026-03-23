const { supabase } = require('./supabase');
const { logger } = require('../utils/logger');

const DEFAULT_PREFERENCES = {
  scan_complete: true,
  risk_alerts: true,
  weekly_summary: true,
};

/**
 * Gets notification preferences for a user.
 * Creates default preferences if none exist.
 */
async function getNotificationPrefs(userId) {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // No row found — return defaults (will be created on first update)
      return { user_id: userId, ...DEFAULT_PREFERENCES };
    }
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Failed to get notification prefs', { userId, error: error.message });
    return { user_id: userId, ...DEFAULT_PREFERENCES };
  }
}

/**
 * Updates notification preferences for a user (upsert).
 * Supports partial updates: omitted fields keep their existing values.
 */
async function updateNotificationPrefs(userId, prefs) {
  try {
    const incomingPrefs = prefs || {};

    // Fetch current preferences to merge with, so omitted fields are not reset
    const currentPrefs = await getNotificationPrefs(userId);

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          scan_complete: incomingPrefs.scan_complete ?? currentPrefs.scan_complete,
          risk_alerts: incomingPrefs.risk_alerts ?? currentPrefs.risk_alerts,
          weekly_summary: incomingPrefs.weekly_summary ?? currentPrefs.weekly_summary,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) throw error;
    logger.info('Notification prefs updated', { userId });
    return data;
  } catch (error) {
    logger.error('Failed to update notification prefs', { userId, error: error.message });
    throw error;
  }
}

module.exports = { getNotificationPrefs, updateNotificationPrefs, DEFAULT_PREFERENCES };
