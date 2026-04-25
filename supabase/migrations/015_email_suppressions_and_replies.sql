-- Email suppressions, bounce/complaint tracking, and reply handling
--
-- This migration adds:
--   1. email_suppressions table — central opt-out / hard-bounce / complaint list.
--      Any send path must check this table before sending.
--   2. replied_at and unsubscribed_at columns on site_contact_history so analytics
--      can see which recipients opted out or replied.
--   3. Expands site_contact_events.event_type to include unsubscribe / bounce /
--      complaint / reply events.

CREATE TABLE IF NOT EXISTS email_suppressions (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  source_contact_history_id UUID REFERENCES site_contact_history(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_suppressions_reason_check'
  ) THEN
    ALTER TABLE email_suppressions
      ADD CONSTRAINT email_suppressions_reason_check
      CHECK (reason IN ('unsubscribe', 'hard_bounce', 'spam_complaint', 'manual', 'invalid_address'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_suppressions_created_at
  ON email_suppressions(created_at DESC);

ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no public read policy. Admin panel uses service role.

-- Expand site_contact_history with unsubscribe / reply state
ALTER TABLE site_contact_history
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS complained_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_site_contact_history_recipient_email
  ON site_contact_history(recipient_email);

CREATE INDEX IF NOT EXISTS idx_site_contact_history_provider_message_id
  ON site_contact_history(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- Relax event_type check to include the new event types. Drop + re-add since
-- Postgres doesn't support altering a CHECK constraint in place.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_contact_events_event_type_check'
  ) THEN
    ALTER TABLE site_contact_events DROP CONSTRAINT site_contact_events_event_type_check;
  END IF;

  ALTER TABLE site_contact_events
    ADD CONSTRAINT site_contact_events_event_type_check
    CHECK (event_type IN (
      'sent',
      'open',
      'click',
      'reply',
      'unsubscribe',
      'bounce',
      'spam_complaint',
      'follow_up_scheduled',
      'follow_up_sent',
      'follow_up_skipped',
      'follow_up_canceled'
    ));
END $$;
