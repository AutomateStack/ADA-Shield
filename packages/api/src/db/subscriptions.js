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

module.exports = {
  upsertSubscription,
  getUserSubscription,
  updateSubscriptionStatus,
  PLAN_LIMITS,
};
