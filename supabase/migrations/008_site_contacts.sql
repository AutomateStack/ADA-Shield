-- Add site-level owner and sales contact metadata
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS sales_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS sales_contact_email TEXT;

-- Optional indexes for admin filtering/lookups
CREATE INDEX IF NOT EXISTS idx_sites_owner_email ON sites(owner_email);
CREATE INDEX IF NOT EXISTS idx_sites_sales_contact_email ON sites(sales_contact_email);
