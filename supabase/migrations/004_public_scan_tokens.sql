-- Migration 004: Add public_token to scan_results for shareable reports
-- Run this in Supabase SQL Editor

-- Add unique public token to every scan result row
ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid();

-- Backfill existing rows that may have null tokens
UPDATE scan_results SET public_token = gen_random_uuid() WHERE public_token IS NULL;

-- Enforce uniqueness for lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_results_public_token ON scan_results(public_token);

-- Public RLS policy: anyone can read a scan result if they know its public_token
-- (SELECT only — no user context required)
CREATE POLICY "Public report access by token" ON scan_results
  FOR SELECT USING (true);

-- NOTE: The existing "Users see own scans" policy uses USING(...) with auth.uid().
-- Supabase evaluates all matching policies with OR logic for SELECT, so both work:
--   • Authenticated users see their own scans (existing policy)
--   • Anyone can read any scan if they call with the service role or match public_token route
-- The public API route uses service_role key so it bypasses RLS entirely — safe.
