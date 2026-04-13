-- Migration 014: Persist admin-configured bulk import settings

CREATE TABLE IF NOT EXISTS bulk_import_settings (
  id          TEXT PRIMARY KEY,
  daily_limit INT NOT NULL DEFAULT 2 CHECK (daily_limit >= 1 AND daily_limit <= 100),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO bulk_import_settings (id, daily_limit)
VALUES ('global', 2)
ON CONFLICT (id) DO NOTHING;
