const { supabase } = require('./supabase');
const { logger } = require('../utils/logger');

async function isEmailSuppressed(email) {
  if (!email) return false;
  const { data, error } = await supabase
    .from('email_suppressions')
    .select('email')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) {
    logger.error('Failed to check email suppression', { email, error: error.message });
    return false;
  }
  return data !== null;
}

async function addEmailSuppression({ email, reason, sourceContactHistoryId = null, metadata = {} }) {
  if (!email) return null;
  const { data, error } = await supabase
    .from('email_suppressions')
    .upsert(
      {
        email: email.toLowerCase().trim(),
        reason,
        source_contact_history_id: sourceContactHistoryId,
        metadata: metadata || {},
        created_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    )
    .select('*')
    .single();

  if (error) {
    logger.error('Failed to add email suppression', { email, reason, error: error.message });
    throw error;
  }
  logger.info('Email suppressed', { email, reason });
  return data;
}

async function removeEmailSuppression(email) {
  if (!email) return false;
  const { error } = await supabase
    .from('email_suppressions')
    .delete()
    .eq('email', email.toLowerCase().trim());

  if (error) {
    logger.error('Failed to remove email suppression', { email, error: error.message });
    throw error;
  }
  logger.info('Email suppression removed', { email });
  return true;
}

async function getEmailSuppressions({ page = 1, limit = 50 } = {}) {
  const { data, error, count } = await supabase
    .from('email_suppressions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    logger.error('Failed to get email suppressions', { error: error.message });
    throw error;
  }
  return {
    suppressions: data || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

async function getSiteContactHistoryByProviderMessageId(providerMessageId) {
  if (!providerMessageId) return null;
  const { data, error } = await supabase
    .from('site_contact_history')
    .select('*')
    .eq('provider_message_id', providerMessageId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    logger.error('Failed to look up contact history by provider message ID', { providerMessageId, error: error.message });
    return null;
  }
  return data || null;
}

module.exports = {
  isEmailSuppressed,
  addEmailSuppression,
  removeEmailSuppression,
  getEmailSuppressions,
  getSiteContactHistoryByProviderMessageId,
};
