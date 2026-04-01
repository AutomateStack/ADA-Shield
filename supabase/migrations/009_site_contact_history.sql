-- Add admin outreach contact history table
CREATE TABLE IF NOT EXISTS site_contact_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  template_style TEXT,
  delivery_channel TEXT CHECK (delivery_channel IN ('supabase-function', 'api-fallback')),
  delivery_status TEXT CHECK (delivery_status IN ('sent', 'failed')) DEFAULT 'sent',
  provider_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_contact_history_site_id
  ON site_contact_history(site_id);

CREATE INDEX IF NOT EXISTS idx_site_contact_history_created_at
  ON site_contact_history(created_at DESC);
