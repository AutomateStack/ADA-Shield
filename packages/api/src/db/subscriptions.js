const { supabase } = require('./supabase');
const { logger } = require('../utils/logger');

/**
 * Creates or updates a subscription record.
 * @param {object} params
 * @param {string} params.userId - User UUID.
 * @param {string} params.stripeCustomerId - Stripe customer ID.
 * @param {string} params.stripeSubscriptionId - Stripe subscription ID.
 * @param {string} params.plan - Plan name (starter/business/agency).
 * @param {string} params.status - Subscription status.
 * @param {number} params.pagesLimit - Pages per scan limit.
 * @param {number} params.sitesLimit - Max sites allowed.
 * @param {string} params.currentPeriodEnd - Period end ISO timestamp.
 * @returns {Promise<object>} The subscription row.
 */
async function upsertSubscription(params) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: params.userId,
          stripe_customer_id: params.stripeCustomerId,
          stripe_subscription_id: params.stripeSubscriptionId,
          plan: params.plan,
          status: params.status,
          pages_limit: params.pagesLimit,
          sites_limit: params.sitesLimit,
          current_period_end: params.currentPeriodEnd,
        },
        { onConflict: 'stripe_subscription_id' }
      )
      .select()
      .single();

    if (error) throw error;

    logger.info('Subscription upserted', {
      userId: params.userId,
      plan: params.plan,
      status: params.status,
    });
    return data;
  } catch (error) {
    logger.error('Failed to upsert subscription', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Gets the active subscription for a user.
 * @param {string} userId - User UUID.
 * @returns {Promise<object|null>} Subscription row or null.
 */
async function getUserSubscription(userId) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    logger.error('Failed to get user subscription', {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Updates the status of a subscription by Stripe subscription ID.
 * @param {string} stripeSubscriptionId - Stripe subscription ID.
 * @param {string} status - New status.
 * @returns {Promise<object|null>} Updated subscription or null.
 */
async function updateSubscriptionStatus(stripeSubscriptionId, status) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status })
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .select()
      .single();

    if (error) throw error;
    logger.info('Subscription status updated', {
      stripeSubscriptionId,
      status,
    });
    return data;
  } catch (error) {
    logger.error('Failed to update subscription status', {
      stripeSubscriptionId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Plan configuration: limits for each tier.
 * @type {Record<string, { pagesLimit: number, sitesLimit: number }>}
 */
const PLAN_LIMITS = {
  starter: { pagesLimit: 10, sitesLimit: 1 },
  business: { pagesLimit: 50, sitesLimit: 5 },
  agency: { pagesLimit: 9999, sitesLimit: 9999 },
};

/**
 * Creates or updates a subscription for a user identified by email.
 * Used by the Gumroad webhook where only the buyer's email is known.
 *
 * @param {string} email - Buyer email from Gumroad.
 * @param {object} params
 * @param {string} params.plan - Plan name (starter/business/agency).
 * @param {string} params.status - active | canceled
 * @param {string} params.gumroadSaleId - Gumroad sale_id.
 * @param {string} params.currentPeriodEnd - ISO timestamp.
 * @returns {Promise<void>}
 */
async function upsertSubscriptionByEmail(email, params) {
  try {
    // Look up user in profiles table (mirrors auth.users, populated on signup)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      logger.error('Gumroad webhook: no account found for email', { email });
      return null;
    }

    const userId = profile.id;
    const limits = PLAN_LIMITS[params.plan] || PLAN_LIMITS.starter;

    // Check if a row already exists for this user
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan: params.plan,
          status: params.status,
          pages_limit: limits.pagesLimit,
          sites_limit: limits.sitesLimit,
          current_period_end: params.currentPeriodEnd,
          gumroad_sale_id: params.gumroadSaleId,
        })
        .eq('user_id', userId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan: params.plan,
          status: params.status,
          pages_limit: limits.pagesLimit,
          sites_limit: limits.sitesLimit,
          current_period_end: params.currentPeriodEnd,
          gumroad_sale_id: params.gumroadSaleId,
        });
      if (error) throw error;
    }

    logger.info('Gumroad subscription upserted', {
      userId,
      email,
      plan: params.plan,
      status: params.status,
    });

    return userId;
  } catch (error) {
    logger.error('Failed to upsert Gumroad subscription', { email, error: error.message });
    throw error;
  }
}

module.exports = {
  upsertSubscription,
  upsertSubscriptionByEmail,
  getUserSubscription,
  updateSubscriptionStatus,
  PLAN_LIMITS,
};
