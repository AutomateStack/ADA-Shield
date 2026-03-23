const { Router } = require('express');
const express = require('express');
const Stripe = require('stripe');
const { upsertSubscription, updateSubscriptionStatus, PLAN_LIMITS } = require('../db/subscriptions');
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
module.exports = { webhookRoutes };
