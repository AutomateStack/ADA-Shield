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
 * Updates notification preferences for a user.
 * Supports partial updates: omitted fields keep their existing values.
 * Uses UPDATE-then-INSERT to avoid read-modify-write race conditions under
 * concurrent requests — only the explicitly provided fields are modified.
 */
async function updateNotificationPrefs(userId, prefs) {
  try {
    const incomingPrefs = prefs || {};

    // Build the update payload from only the explicitly provided fields
    const updatePayload = {};
    if (incomingPrefs.scan_complete !== undefined) updatePayload.scan_complete = incomingPrefs.scan_complete;
    if (incomingPrefs.risk_alerts !== undefined) updatePayload.risk_alerts = incomingPrefs.risk_alerts;
    if (incomingPrefs.weekly_summary !== undefined) updatePayload.weekly_summary = incomingPrefs.weekly_summary;

    if (Object.keys(updatePayload).length === 0) {
      // Nothing to change — return current prefs (or defaults if row doesn't exist yet)
      return getNotificationPrefs(userId);
    }

    // Attempt UPDATE first — only the provided fields are touched, so concurrent
    // partial updates for different fields cannot overwrite each other.
    const { data: updated, error: updateError } = await supabase
      .from('notification_preferences')
      .update(updatePayload)
      .eq('user_id', userId)
      .select()
      .single();

    if (!updateError) {
      logger.info('Notification prefs updated', { userId });
      return updated;
    }

    // PGRST116 means no row matched — INSERT a new row merging defaults with incoming values
    if (updateError.code === 'PGRST116') {
      const { data: inserted, error: insertError } = await supabase
        .from('notification_preferences')
        .insert({
          user_id: userId,
          ...DEFAULT_PREFERENCES,
          ...updatePayload,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      logger.info('Notification prefs created', { userId });
      return inserted;
    }

    throw updateError;
  } catch (error) {
    logger.error('Failed to update notification prefs', { userId, error: error.message });
    throw error;
  }
}

module.exports = { getNotificationPrefs, updateNotificationPrefs, DEFAULT_PREFERENCES };
