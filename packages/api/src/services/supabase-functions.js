const { logger } = require('../utils/logger');

/**
 * Builds the Supabase Functions base URL.
 * Prefer explicit SUPABASE_FUNCTIONS_URL; otherwise derive from SUPABASE_URL.
 * @returns {string | null}
 */
function getFunctionsBaseUrl() {
  const explicit = (process.env.SUPABASE_FUNCTIONS_URL || '').trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;
}

/**
 * Invokes a Supabase Edge Function.
 * @param {string} functionName
 * @param {Record<string, any>} payload
 */
async function invokeSupabaseFunction(functionName, payload) {
  const baseUrl = getFunctionsBaseUrl();
  if (!baseUrl) {
    throw new Error('SUPABASE_FUNCTIONS_URL or SUPABASE_URL is not configured');
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to invoke Edge Functions from API');
  }

  const internalSecret = process.env.INTERNAL_API_SECRET || '';
  const url = `${baseUrl}/${functionName}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'x-internal-api-secret': internalSecret,
    },
    body: JSON.stringify(payload || {}),
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (_) {
    parsed = { message: text };
  }

  if (!response.ok) {
    logger.error('Supabase function invocation failed', {
      functionName,
      status: response.status,
      response: parsed,
    });
    throw new Error(parsed?.error || parsed?.message || `Edge function failed (${response.status})`);
  }

  return parsed;
}

module.exports = {
  invokeSupabaseFunction,
};
