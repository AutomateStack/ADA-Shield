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
 * Preserves existing values for fields not supplied in `prefs`.
 */
async function updateNotificationPrefs(userId, prefs) {
  try {
    const currentPrefs = await getNotificationPrefs(userId);
    const safePrefs = prefs || {};

    const updatedPrefs = {
      user_id: userId,
      scan_complete:
        'scan_complete' in safePrefs ? safePrefs.scan_complete : currentPrefs.scan_complete,
      risk_alerts:
        'risk_alerts' in safePrefs ? safePrefs.risk_alerts : currentPrefs.risk_alerts,
      weekly_summary:
        'weekly_summary' in safePrefs ? safePrefs.weekly_summary : currentPrefs.weekly_summary,
    };

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(updatedPrefs, { onConflict: 'user_id' })
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
