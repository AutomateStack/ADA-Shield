const { Router } = require('express');
const express = require('express');
const Stripe = require('stripe');
const { upsertSubscription, upsertSubscriptionByEmail, updateSubscriptionStatus, PLAN_LIMITS } = require('../db/subscriptions');
const { logger } = require('../utils/logger');

const router = Router();

// Stripe webhooks need raw body for signature verification
router.use(express.raw({ type: 'application/json' }));

/**
 * Stripe webhook handler.
 * Handles: checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted, invoice.payment_failed
 */
router.post('/', async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    logger.error('Stripe webhook signature verification failed', {
      error: error.message,
    });
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutCompleted(stripe, session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await handlePaymentFailed(invoice);
        break;
      }
      default: {
        logger.info('Unhandled Stripe event', { type: event.type });
      }
    }

    return res.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook handler error', {
      type: event.type,
      error: error.message,
    });
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * Handles checkout.session.completed — creates subscription record.
 */
async function handleCheckoutCompleted(stripe, session) {
  const subscriptionId = session.subscription;
  const customerId = session.customer;
  const userId = session.metadata?.userId;

  if (!userId) {
    logger.error('Missing userId in checkout session metadata');
    return;
  }

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = sub.items.data[0]?.price?.id;
  const plan = getPlanFromPriceId(priceId);
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

  await upsertSubscription({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    plan,
    status: sub.status,
    pagesLimit: limits.pagesLimit,
    sitesLimit: limits.sitesLimit,
    currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
  });

  logger.info('Checkout completed', { userId, plan });
}

/**
 * Handles customer.subscription.updated — updates plan/status.
 */
async function handleSubscriptionUpdated(subscription) {
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = getPlanFromPriceId(priceId);
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

  const userId = subscription.metadata?.userId;
  if (!userId) {
    // Legacy/incomplete subscriptions may lack metadata.userId.
    // Still update the status so changes are not silently ignored.
    await updateSubscriptionStatus(subscription.id, subscription.status);
    logger.error('Missing userId in subscription metadata — updated status only', {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      status: subscription.status,
    });
    return;
  }

  await upsertSubscription({
    userId,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    plan,
    status: subscription.status,
    pagesLimit: limits.pagesLimit,
    sitesLimit: limits.sitesLimit,
    currentPeriodEnd: new Date(
      subscription.current_period_end * 1000
    ).toISOString(),
  });

  logger.info('Subscription updated', { plan, status: subscription.status });
}

/**
 * Handles customer.subscription.deleted — marks as canceled.
 */
async function handleSubscriptionDeleted(subscription) {
  await updateSubscriptionStatus(subscription.id, 'canceled');
  logger.info('Subscription canceled', {
    stripeSubscriptionId: subscription.id,
  });
}

/**
 * Handles invoice.payment_failed — marks as past_due.
 */
async function handlePaymentFailed(invoice) {
  if (invoice.subscription) {
    await updateSubscriptionStatus(invoice.subscription, 'past_due');
    logger.warn('Payment failed — subscription set to past_due', {
      stripeSubscriptionId: invoice.subscription,
    });
  }
}

/**
 * Maps a Stripe price ID to our plan name.
 * @param {string} priceId - Stripe price ID.
 * @returns {string} Plan name (starter/business/agency).
 */
function getPlanFromPriceId(priceId) {
  const priceMap = {
    [process.env.STRIPE_STARTER_PRICE_ID]: 'starter',
    [process.env.STRIPE_BUSINESS_PRICE_ID]: 'business',
    [process.env.STRIPE_AGENCY_PRICE_ID]: 'agency',
  };
  return priceMap[priceId] || 'starter';
}

const webhookRoutes = router;

// ════════════════════════════════════════════════════════════════════════
// Gumroad Webhook Handler
// POST /api/webhooks/gumroad?token=<GUMROAD_WEBHOOK_TOKEN>
// Gumroad sends application/x-www-form-urlencoded
// ════════════════════════════════════════════════════════════════════════

const gumroadRouter = Router();
gumroadRouter.use(express.urlencoded({ extended: false }));

/**
 * Determine plan from Gumroad purchase: check variants first, then price.
 * @param {string} variantsJson - JSON string from Gumroad variants field.
 * @param {number} priceInCents
 * @returns {'starter'|'business'|'agency'}
 */
function getPlanFromGumroad(variantsJson, priceInCents) {
  try {
    const variants = JSON.parse(variantsJson || '{}');
    const tier = Object.values(variants).join(' ').toLowerCase();
    if (tier.includes('agency')) return 'agency';
    if (tier.includes('business')) return 'business';
    if (tier.includes('starter')) return 'starter';
  } catch (_) { /* fall through to price */ }

  // Fall back to price matching (amounts in US cents)
  if (priceInCents >= 19000) return 'agency';
  if (priceInCents >= 9000) return 'business';
  return 'starter';
}

gumroadRouter.post('/', async (req, res) => {
  // Validate shared secret token from URL query string
  const expectedToken = process.env.GUMROAD_WEBHOOK_TOKEN;
  if (expectedToken && req.query.token !== expectedToken) {
    logger.warn('Gumroad webhook: invalid token');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    email,
    sale_id: saleId,
    price,           // price in US cents as a string
    variants,
    refunded,
    recurrence,
  } = req.body;

  if (!email || !saleId) {
    logger.error('Gumroad webhook: missing required fields', { email, saleId });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Refund → cancel the subscription
    if (refunded === 'true' || refunded === true) {
      logger.info('Gumroad refund received — canceling subscription', { email, saleId });
      await upsertSubscriptionByEmail(email, {
        plan: 'starter', // keep plan reference, status drives access
        status: 'canceled',
        gumroadSaleId: saleId,
        currentPeriodEnd: new Date().toISOString(),
      });
      return res.json({ received: true });
    }

    const priceInCents = parseInt(price, 10) || 0;
    const plan = getPlanFromGumroad(variants, priceInCents);

    // Set period end: 35 days for monthly (5-day buffer), 370 for yearly
    const periodDays = recurrence === 'yearly' ? 370 : 35;
    const currentPeriodEnd = new Date(
      Date.now() + periodDays * 24 * 60 * 60 * 1000
    ).toISOString();

    await upsertSubscriptionByEmail(email, {
      plan,
      status: 'active',
      gumroadSaleId: saleId,
      currentPeriodEnd,
    });

    logger.info('Gumroad sale processed', { email, plan, saleId });
    return res.json({ received: true });
  } catch (error) {
    logger.error('Gumroad webhook handler error', { error: error.message });
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
});

module.exports = { webhookRoutes, gumroadWebhookRoutes: gumroadRouter };
