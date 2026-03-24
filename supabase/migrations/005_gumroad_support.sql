-- Migration 005: Add Gumroad payment support to subscriptions table
-- Run this in Supabase SQL Editor

-- Add gumroad_sale_id column to store the most recent Gumroad sale ID.
-- Nullable: existing Stripe-billed subscriptions leave this NULL.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS gumroad_sale_id TEXT;

-- Make stripe_customer_id and stripe_subscription_id explicitly nullable
-- (they already are, but this documents intent clearly).
-- Gumroad subscriptions will have NULL for these columns.

-- Index for faster lookup when Gumroad sends recurring sale webhooks.
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id_unique
  ON subscriptions(user_id);
