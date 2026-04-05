-- Migration 013: Add social/contact columns to sites for bulk import
-- These are purely additive — no existing data is changed.

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS facebook_url   TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url  TEXT,
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS import_source  TEXT;     -- e.g. 'excel_bulk_import'

-- Track bulk import batches so the admin can see what was uploaded when.
CREATE TABLE IF NOT EXISTS bulk_import_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_name       TEXT,
  row_count       INT NOT NULL DEFAULT 0,
  imported_count  INT NOT NULL DEFAULT 0,
  skipped_count   INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',   -- pending | processing | done | failed
  error_details   JSONB,
  notes           TEXT
);

-- Index so the admin list loads fast.
CREATE INDEX IF NOT EXISTS idx_bulk_import_batches_created_at
  ON bulk_import_batches (created_at DESC);
