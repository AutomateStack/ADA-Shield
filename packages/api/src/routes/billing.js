const { Router } = require('express');
const Stripe = require('stripe');
const { authenticate } = require('../middleware/auth');
const { getUserSubscription } = require('../db/subscriptions');
const { supabase } = require('../db/supabase');
const { logger } = require('../utils/logger');

const router = Router();

/**
 * Maps plan names to Stripe price IDs from environment variables.
 */
function getPriceId(plan) {
  const map = {
    starter: process.env.STRIPE_STARTER_PRICE_ID,
    business: process.env.STRIPE_BUSINESS_PRICE_ID,
    agency: process.env.STRIPE_AGENCY_PRICE_ID,
  };
  return map[plan];
}

// ── Create Checkout Session ─────────────────────────────────────────
router.post('/checkout', authenticate, async (req, res, next) => {
  try {
    const { plan } = req.body;
    const userId = req.user.id;
    const email = req.user.email;

    if (!['starter', 'business', 'agency'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Use starter, business, or agency.' });
    }

    const priceId = getPriceId(plan);
    if (!priceId || priceId === 'price_xxx') {
      return res.status(500).json({ error: 'Stripe price ID not configured for this plan.' });
    }

    // Check if user already has an active subscription
    const existing = await getUserSubscription(userId);
    if (existing && existing.status === 'active') {
      return res.status(400).json({
        error: 'You already have an active subscription. Use the billing portal to manage it.',
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';

    // Find or create Stripe customer
    let customerId;
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .single();

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${dashboardUrl}/dashboard/settings?checkout=success`,
      cancel_url: `${dashboardUrl}/dashboard/billing?checkout=canceled`,
      metadata: { userId, plan },
      subscription_data: {
        metadata: { userId, plan },
      },
    });

    logger.info('Checkout session created', { userId, plan, sessionId: session.id });
    return res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// ── Customer Portal ─────────────────────────────────────────────────
router.post('/portal', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const subscription = await getUserSubscription(userId);

    if (!subscription?.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found.' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${dashboardUrl}/dashboard/settings`,
    });

    logger.info('Portal session created', { userId });
    return res.json({ url: portalSession.url });
  } catch (error) {
    next(error);
  }
});

// ── Get Current Subscription ────────────────────────────────────────
router.get('/subscription', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      return res.json({
        plan: 'free',
        status: null,
        currentPeriodEnd: null,
        pagesLimit: 1,
        sitesLimit: 1,
      });
    }

    return res.json({
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      pagesLimit: subscription.pages_limit,
      sitesLimit: subscription.sites_limit,
    });
  } catch (error) {
    next(error);
  }
});

const billingRoutes = router;
module.exports = { billingRoutes };
