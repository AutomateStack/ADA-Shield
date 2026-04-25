-- Site notes and outreach pause flag
--
-- notes       — freetext admin notes on a site (contact context, call logs, etc.)
-- outreach_paused — when TRUE the site is excluded from the daily bulk outreach queue

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS outreach_paused BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index so the bulk-queue filter on outreach_paused = false is fast
CREATE INDEX IF NOT EXISTS idx_sites_outreach_paused
  ON sites(outreach_paused)
  WHERE outreach_paused = TRUE;
