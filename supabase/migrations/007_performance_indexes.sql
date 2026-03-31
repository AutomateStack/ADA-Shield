-- Performance indexes for common query patterns
-- Composite indexes dramatically improve dashboard and admin queries

-- Composite index: site scans ordered by date (most common dashboard query)
CREATE INDEX IF NOT EXISTS idx_scan_results_site_scanned
  ON scan_results(site_id, scanned_at DESC);

-- Composite index: user scans ordered by date (admin user detail) 
CREATE INDEX IF NOT EXISTS idx_scan_results_user_scanned
  ON scan_results(user_id, scanned_at DESC);

-- Index on public_token for shareable report lookups
CREATE INDEX IF NOT EXISTS idx_scan_results_public_token
  ON scan_results(public_token) WHERE public_token IS NOT NULL;

-- Index on risk_score for filtering/sorting by risk
CREATE INDEX IF NOT EXISTS idx_scan_results_risk_score
  ON scan_results(risk_score DESC);

-- Composite: subscription lookups by user + status (billing checks)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON subscriptions(user_id, status);

-- Composite: sites by user + creation order (dashboard listing)
CREATE INDEX IF NOT EXISTS idx_sites_user_created
  ON sites(user_id, created_at DESC);

-- Partial index: only active subscriptions (most queries filter by active)
CREATE INDEX IF NOT EXISTS idx_subscriptions_active
  ON subscriptions(user_id) WHERE status = 'active';

-- Index for URL-based aggregation queries (admin top URLs)
CREATE INDEX IF NOT EXISTS idx_scan_results_url
  ON scan_results(url);
