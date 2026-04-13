-- Add outreach email tracking, lead scoring, and follow-up automation support

ALTER TABLE site_contact_history
  ADD COLUMN IF NOT EXISTS send_batch_id UUID,
  ADD COLUMN IF NOT EXISTS parent_contact_history_id UUID REFERENCES site_contact_history(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scan_id UUID REFERENCES scan_results(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tracking_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS report_url TEXT,
  ADD COLUMN IF NOT EXISTS tracked_report_url TEXT,
  ADD COLUMN IF NOT EXISTS tracking_pixel_url TEXT,
  ADD COLUMN IF NOT EXISTS opens_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_clicked_url TEXT,
  ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_event_type TEXT,
  ADD COLUMN IF NOT EXISTS lead_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_status TEXT NOT NULL DEFAULT 'cold',
  ADD COLUMN IF NOT EXISTS follow_up_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS follow_up_rule TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_contact_history_lead_status_check'
  ) THEN
    ALTER TABLE site_contact_history
      ADD CONSTRAINT site_contact_history_lead_status_check
      CHECK (lead_status IN ('cold', 'warm', 'hot'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_contact_history_follow_up_status_check'
  ) THEN
    ALTER TABLE site_contact_history
      ADD CONSTRAINT site_contact_history_follow_up_status_check
      CHECK (follow_up_status IN ('none', 'scheduled', 'sent', 'skipped', 'canceled'));
  END IF;
END $$;

UPDATE site_contact_history
SET tracking_token = gen_random_uuid()
WHERE tracking_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_contact_history_tracking_token
  ON site_contact_history(tracking_token);

CREATE INDEX IF NOT EXISTS idx_site_contact_history_send_batch_id
  ON site_contact_history(send_batch_id);

CREATE INDEX IF NOT EXISTS idx_site_contact_history_parent_id
  ON site_contact_history(parent_contact_history_id);

CREATE INDEX IF NOT EXISTS idx_site_contact_history_lead_score
  ON site_contact_history(lead_score DESC);

CREATE INDEX IF NOT EXISTS idx_site_contact_history_follow_up_status
  ON site_contact_history(follow_up_status, follow_up_scheduled_for DESC);

CREATE TABLE IF NOT EXISTS site_contact_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  contact_history_id UUID REFERENCES site_contact_history(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent TEXT,
  ip_address_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_contact_events_event_type_check'
  ) THEN
    ALTER TABLE site_contact_events
      ADD CONSTRAINT site_contact_events_event_type_check
      CHECK (event_type IN ('sent', 'open', 'click', 'follow_up_scheduled', 'follow_up_sent', 'follow_up_skipped', 'follow_up_canceled'));
  END IF;
END $$;

ALTER TABLE site_contact_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own site contact events" ON site_contact_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = site_contact_events.site_id
        AND sites.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_site_contact_events_contact_id
  ON site_contact_events(contact_history_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_contact_events_site_id
  ON site_contact_events(site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_contact_events_type
  ON site_contact_events(event_type, created_at DESC);