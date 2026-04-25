-- Atomic increment for site outreach tracking.
-- Replaces the read-modify-write pattern in markSiteAsContacted so concurrent
-- or retried jobs cannot double-count contacts or miss updating last_contacted_at.

CREATE OR REPLACE FUNCTION increment_site_contacted(p_site_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE sites
  SET
    contacted_count   = COALESCE(contacted_count, 0) + 1,
    last_contacted_at = NOW()
  WHERE id = p_site_id;
$$;
