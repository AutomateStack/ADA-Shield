-- ADA Shield Database Schema
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════════
-- Sites table
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  monitoring_active BOOLEAN DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  pages_to_scan INTEGER DEFAULT 10
);

-- ═══════════════════════════════════════════════════════════════════
-- Scan results table
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS scan_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  risk_score INTEGER,
  total_violations INTEGER,
  critical_count INTEGER,
  serious_count INTEGER,
  moderate_count INTEGER,
  minor_count INTEGER,
  violations JSONB,
  passed_rules INTEGER,
  incomplete_rules INTEGER,
  job_id TEXT,
  scan_duration_ms INTEGER
);

-- ═══════════════════════════════════════════════════════════════════
-- Subscriptions table
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT CHECK (plan IN ('starter', 'business', 'agency')),
  status TEXT CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  pages_limit INTEGER,
  sites_limit INTEGER,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- Notification preferences table
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  scan_complete BOOLEAN DEFAULT true,
  risk_alerts BOOLEAN DEFAULT true,
  weekly_summary BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Sites: users can only manage their own sites
CREATE POLICY "Users manage own sites" ON sites
  FOR ALL USING (auth.uid() = user_id);

-- Scan results: users can only see scans for their own sites
CREATE POLICY "Users see own scans" ON scan_results
  FOR ALL USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = scan_results.site_id
        AND sites.user_id = auth.uid()
    )
  );

-- Subscriptions: users can only see their own subscription
CREATE POLICY "Users see own subscription" ON subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Notification preferences: users can only manage their own
CREATE POLICY "Users manage own notification prefs" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- Indexes for performance
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_site_id ON scan_results(site_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_user_id ON scan_results(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_scanned_at ON scan_results(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_monitoring ON sites(monitoring_active) WHERE monitoring_active = true;
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences(user_id);
