-- Add support for multiple notification recipients per site
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS notification_recipients JSONB DEFAULT '[]'::jsonb;

-- Create index for querying sites with specific recipients
CREATE INDEX IF NOT EXISTS idx_sites_notification_recipients 
  ON sites USING GIN (notification_recipients);

-- Add comment for clarity
COMMENT ON COLUMN sites.notification_recipients IS 'Array of email addresses for notifications: ["info@example.com", "admin@example.com"]';
