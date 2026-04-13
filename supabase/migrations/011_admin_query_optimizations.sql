-- Admin query optimization helpers
-- These functions reduce API memory usage by pushing heavy grouping work to Postgres.

-- Returns latest scan snapshot per site (1 row per site).
CREATE OR REPLACE FUNCTION public.get_latest_scan_per_site(site_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  site_id uuid,
  risk_score integer,
  scanned_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (sr.site_id)
    sr.site_id,
    sr.risk_score,
    sr.scanned_at
  FROM scan_results sr
  WHERE sr.site_id IS NOT NULL
    AND (site_ids IS NULL OR sr.site_id = ANY(site_ids))
  ORDER BY sr.site_id, sr.scanned_at DESC;
$$;

-- Returns most frequently scanned hostnames.
CREATE OR REPLACE FUNCTION public.get_top_scanned_urls(limit_count integer DEFAULT 10)
RETURNS TABLE (
  hostname text,
  scan_count bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH parsed AS (
    SELECT
      lower(
        split_part(
          split_part(
            regexp_replace(url, '^https?://', '', 'i'),
            '/',
            1
          ),
          ':',
          1
        )
      ) AS hostname
    FROM scan_results
    WHERE url IS NOT NULL
      AND url <> ''
  )
  SELECT
    p.hostname,
    COUNT(*)::bigint AS scan_count
  FROM parsed p
  WHERE p.hostname <> ''
  GROUP BY p.hostname
  ORDER BY scan_count DESC
  LIMIT GREATEST(COALESCE(limit_count, 10), 1);
$$;

-- Helpful index for the DISTINCT ON pattern above.
CREATE INDEX IF NOT EXISTS idx_scan_results_site_scanned_latest
  ON scan_results(site_id, scanned_at DESC)
  WHERE site_id IS NOT NULL;
