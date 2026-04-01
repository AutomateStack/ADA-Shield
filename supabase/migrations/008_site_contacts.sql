-- Add site-level owner metadata and contact tracking
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS contacted_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

-- Optional indexes for contact tracking
CREATE INDEX IF NOT EXISTS idx_sites_owner_email ON sites(owner_email);
CREATE INDEX IF NOT EXISTS idx_sites_last_contacted ON sites(last_contacted_at DESC);
