-- Migration: Add `type` column to sites table to track scan source (free/admin/registered)

ALTER TABLE sites ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'free' CHECK (type IN ('free', 'admin', 'registered'));

-- Create index for faster filtering by type
CREATE INDEX IF NOT EXISTS idx_sites_type ON sites(type);

-- Update existing free scan sites (where user_id is NULL) to have type='free'
UPDATE sites SET type = 'free' WHERE user_id IS NULL AND type = 'free';

-- Update existing registered sites (where user_id is NOT NULL) to have type='registered'
UPDATE sites SET type = 'registered' WHERE user_id IS NOT NULL AND type = 'free';

-- Create composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_sites_type_contacted ON sites(type, contacted_count) WHERE contacted_count > 0;
