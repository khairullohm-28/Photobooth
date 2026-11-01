-- ============================================================================
-- MIGRATION: Analytics Events & High-Performance RPC Aggregations for Photobooth
-- Date: 2026-10-31
-- Description:
--   1. Create `analytics_events` table tracking guest funnel steps, OS, and camera.
--   2. Grant anonymous INSERT & role-based SELECT.
--   3. Create RPC functions for Dashboard & Reports to compute aggregations
--      server-side on the database (sub-100ms even with 100,000+ sessions).
-- ============================================================================

-- 1. Analytics Events Table
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  step TEXT NOT NULL CHECK (step IN ('start', 'frame', 'photos_done', 'filter', 'download')),
  device_os TEXT DEFAULT 'Other',
  camera_facing TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lightning-fast aggregated queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_step ON public.analytics_events(event_id, step);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_step ON public.analytics_events(step);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Anonymous users (guests) can only INSERT tracking steps
DROP POLICY IF EXISTS "Anon can insert analytics_events" ON public.analytics_events;
CREATE POLICY "Anon can insert analytics_events"
  ON public.analytics_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins can read analytics events
DROP POLICY IF EXISTS "Admin can read analytics_events" ON public.analytics_events;
CREATE POLICY "Admin can read analytics_events"
  ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE id = auth.uid()
        AND is_active = true
        AND (
          role = 'owner'
          OR permissions @> ARRAY['*']::text[]
          OR permissions @> ARRAY['dashboard']::text[]
          OR permissions @> ARRAY['reports']::text[]
        )
    )
  );

-- ============================================================================
-- 2. RPC AGGREGATION FUNCTIONS
-- ============================================================================

-- Function: rpc_dashboard_summary
CREATE OR REPLACE FUNCTION public.rpc_dashboard_summary(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_allowed_event_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_from TIMESTAMPTZ := COALESCE(p_from, now() - INTERVAL '30 days');
  v_to TIMESTAMPTZ := COALESCE(p_to, now());
  v_active_events INT;
  v_total_sessions INT;
  v_total_photos INT;
  v_total_prints INT;
  v_avg_retakes NUMERIC;
  v_storage_bytes BIGINT;
  v_expiring_24h INT;
BEGIN
  -- Active events count
  SELECT COUNT(*) INTO v_active_events
  FROM public.events
  WHERE status = 'aktif'
    AND (p_event_id IS NULL OR id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR id = ANY(p_allowed_event_ids));

  -- Total sessions in period (including expired metadata)
  SELECT COUNT(*) INTO v_total_sessions
  FROM public.sessions
  WHERE created_at BETWEEN v_from AND v_to
    AND (p_event_id IS NULL OR event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR event_id = ANY(p_allowed_event_ids));

  -- Total photos captured in period
  SELECT COUNT(*) INTO v_total_photos
  FROM public.session_assets sa
  JOIN public.sessions s ON s.id = sa.session_id
  WHERE sa.type = 'raw_photo'
    AND s.created_at BETWEEN v_from AND v_to
    AND (p_event_id IS NULL OR s.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids));

  -- Total prints count (sum of copies)
  SELECT COALESCE(SUM(pj.copies), 0) INTO v_total_prints
  FROM public.print_jobs pj
  JOIN public.sessions s ON s.id = pj.session_id
  WHERE pj.printed_at BETWEEN v_from AND v_to
    AND (p_event_id IS NULL OR s.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids));

  -- Average retakes per session
  SELECT ROUND(COALESCE(AVG(retake_count), 0)::numeric, 1) INTO v_avg_retakes
  FROM (
    SELECT s.id, COUNT(sa.id) AS retake_count
    FROM public.sessions s
    LEFT JOIN public.session_assets sa ON sa.session_id = s.id AND sa.type = 'retake_discarded'
    WHERE s.created_at BETWEEN v_from AND v_to
      AND (p_event_id IS NULL OR s.event_id = p_event_id)
      AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids))
    GROUP BY s.id
  ) sub;

  -- Storage estimated bytes (frame composite ~850KB, raw photo ~650KB, live photo ~1.5MB, gif ~1.2MB)
  SELECT COALESCE(SUM(
    CASE sa.type
      WHEN 'frame_result' THEN 870000
      WHEN 'raw_photo' THEN 650000
      WHEN 'live_photo' THEN 1500000
      WHEN 'gif' THEN 1200000
      WHEN 'gif_mp4' THEN 950000
      ELSE 400000
    END
  ), 0)::BIGINT INTO v_storage_bytes
  FROM public.session_assets sa
  JOIN public.sessions s ON s.id = sa.session_id
  WHERE (s.status = 'aktif' OR s.status IS NULL)
    AND (s.files_deleted_at IS NULL)
    AND (p_event_id IS NULL OR s.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids));

  -- Sessions expiring in next 24 hours
  SELECT COUNT(*) INTO v_expiring_24h
  FROM public.sessions
  WHERE (status = 'aktif' OR status IS NULL)
    AND files_deleted_at IS NULL
    AND expires_at BETWEEN now() AND now() + INTERVAL '24 hours'
    AND (p_event_id IS NULL OR event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR event_id = ANY(p_allowed_event_ids));

  RETURN jsonb_build_object(
    'active_events_count', v_active_events,
    'total_sessions', v_total_sessions,
    'total_photos', v_total_photos,
    'total_prints', v_total_prints,
    'avg_retakes', v_avg_retakes,
    'storage_used_bytes', v_storage_bytes,
    'expiring_in_24h_count', v_expiring_24h
  );
END;
$$;

-- Function: rpc_sessions_per_day
CREATE OR REPLACE FUNCTION public.rpc_sessions_per_day(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_allowed_event_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  date_label TEXT,
  sessions_count INT,
  photos_count INT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    to_char(date_trunc('day', s.created_at), 'YYYY-MM-DD') AS date_label,
    COUNT(DISTINCT s.id)::INT AS sessions_count,
    COUNT(sa.id)::INT AS photos_count
  FROM public.sessions s
  LEFT JOIN public.session_assets sa ON sa.session_id = s.id AND sa.type = 'raw_photo'
  WHERE s.created_at BETWEEN COALESCE(p_from, now() - INTERVAL '30 days') AND COALESCE(p_to, now())
    AND (p_event_id IS NULL OR s.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids))
  GROUP BY 1
  ORDER BY 1 ASC;
$$;

-- Function: rpc_sessions_per_hour
CREATE OR REPLACE FUNCTION public.rpc_sessions_per_hour(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_allowed_event_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  hour_of_day INT,
  sessions_count INT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXTRACT(HOUR FROM s.created_at)::INT AS hour_of_day,
    COUNT(*)::INT AS sessions_count
  FROM public.sessions s
  WHERE s.created_at BETWEEN COALESCE(p_from, now() - INTERVAL '30 days') AND COALESCE(p_to, now())
    AND (p_event_id IS NULL OR s.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids))
  GROUP BY 1
  ORDER BY 1 ASC;
$$;

-- Function: rpc_top_templates
CREATE OR REPLACE FUNCTION public.rpc_top_templates(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_allowed_event_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  template_id UUID,
  template_name TEXT,
  thumbnail_url TEXT,
  usage_count INT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    f.id AS template_id,
    f.name AS template_name,
    f.thumbnail_url,
    COUNT(s.id)::INT AS usage_count
  FROM public.frames f
  LEFT JOIN public.sessions s ON s.frame_id = f.id
    AND s.created_at BETWEEN COALESCE(p_from, now() - INTERVAL '30 days') AND COALESCE(p_to, now())
    AND (p_event_id IS NULL OR s.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids))
  GROUP BY f.id, f.name, f.thumbnail_url
  ORDER BY usage_count DESC, f.name ASC;
$$;

-- Function: rpc_top_filters
CREATE OR REPLACE FUNCTION public.rpc_top_filters(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_allowed_event_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  filter_id UUID,
  filter_name TEXT,
  usage_count INT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    fl.id AS filter_id,
    fl.name AS filter_name,
    COUNT(s.id)::INT AS usage_count
  FROM public.filters fl
  LEFT JOIN public.sessions s ON s.filter_id = fl.id
    AND s.created_at BETWEEN COALESCE(p_from, now() - INTERVAL '30 days') AND COALESCE(p_to, now())
    AND (p_event_id IS NULL OR s.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids))
  GROUP BY fl.id, fl.name
  ORDER BY usage_count DESC, fl.name ASC;
$$;

-- Function: rpc_funnel
CREATE OR REPLACE FUNCTION public.rpc_funnel(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_allowed_event_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  step TEXT,
  step_label TEXT,
  step_order INT,
  count INT,
  drop_off_pct NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_from TIMESTAMPTZ := COALESCE(p_from, now() - INTERVAL '30 days');
  v_to TIMESTAMPTZ := COALESCE(p_to, now());
  v_start_count INT;
  v_frame_count INT;
  v_photos_count INT;
  v_filter_count INT;
  v_download_count INT;
BEGIN
  -- Count events for each step
  SELECT COUNT(*) INTO v_start_count FROM public.analytics_events
  WHERE step = 'start' AND created_at BETWEEN v_from AND v_to
    AND (p_event_id IS NULL OR event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR event_id = ANY(p_allowed_event_ids));

  SELECT COUNT(*) INTO v_frame_count FROM public.analytics_events
  WHERE step = 'frame' AND created_at BETWEEN v_from AND v_to
    AND (p_event_id IS NULL OR event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR event_id = ANY(p_allowed_event_ids));

  SELECT COUNT(*) INTO v_photos_count FROM public.analytics_events
  WHERE step = 'photos_done' AND created_at BETWEEN v_from AND v_to
    AND (p_event_id IS NULL OR event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR event_id = ANY(p_allowed_event_ids));

  SELECT COUNT(*) INTO v_filter_count FROM public.analytics_events
  WHERE step = 'filter' AND created_at BETWEEN v_from AND v_to
    AND (p_event_id IS NULL OR event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR event_id = ANY(p_allowed_event_ids));

  SELECT COUNT(*) INTO v_download_count FROM public.analytics_events
  WHERE step = 'download' AND created_at BETWEEN v_from AND v_to
    AND (p_event_id IS NULL OR event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR event_id = ANY(p_allowed_event_ids));

  -- Return rows with calculated drop off
  RETURN QUERY VALUES
    ('start', 'Mulai', 1, v_start_count, 0.0::numeric),
    ('frame', 'Pilih Frame', 2, v_frame_count,
      CASE WHEN v_start_count > 0 THEN ROUND(((v_start_count - v_frame_count)::numeric / v_start_count * 100), 1) ELSE 0.0 END),
    ('photos_done', 'Foto Selesai', 3, v_photos_count,
      CASE WHEN v_frame_count > 0 THEN ROUND(((v_frame_count - v_photos_count)::numeric / v_frame_count * 100), 1) ELSE 0.0 END),
    ('filter', 'Pilih Filter', 4, v_filter_count,
      CASE WHEN v_photos_count > 0 THEN ROUND(((v_photos_count - v_filter_count)::numeric / v_photos_count * 100), 1) ELSE 0.0 END),
    ('download', 'Unduh / Softfile', 5, v_download_count,
      CASE WHEN v_filter_count > 0 THEN ROUND(((v_filter_count - v_download_count)::numeric / v_filter_count * 100), 1) ELSE 0.0 END);
END;
$$;

-- Function: rpc_downloads_by_type
CREATE OR REPLACE FUNCTION public.rpc_downloads_by_type(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_allowed_event_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  asset_type TEXT,
  label TEXT,
  count INT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    sa.type AS asset_type,
    CASE sa.type
      WHEN 'frame_result' THEN 'Frame Hasil'
      WHEN 'live_photo' THEN 'Live Photo'
      WHEN 'gif' THEN 'Animasi GIF'
      WHEN 'gif_mp4' THEN 'Video MP4'
      WHEN 'raw_photo' THEN 'Foto Satuan'
      ELSE 'Lainnya'
    END AS label,
    COUNT(sa.id)::INT AS count
  FROM public.session_assets sa
  JOIN public.sessions s ON s.id = sa.session_id
  WHERE s.created_at BETWEEN COALESCE(p_from, now() - INTERVAL '30 days') AND COALESCE(p_to, now())
    AND sa.type IN ('frame_result', 'live_photo', 'gif', 'gif_mp4', 'raw_photo')
    AND (p_event_id IS NULL OR s.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids))
  GROUP BY sa.type, 2
  ORDER BY count DESC;
$$;

-- Function: rpc_prints_per_day
CREATE OR REPLACE FUNCTION public.rpc_prints_per_day(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_allowed_event_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  date_label TEXT,
  jobs_count INT,
  copies_count INT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    to_char(date_trunc('day', pj.printed_at), 'YYYY-MM-DD') AS date_label,
    COUNT(pj.id)::INT AS jobs_count,
    COALESCE(SUM(pj.copies), 0)::INT AS copies_count
  FROM public.print_jobs pj
  JOIN public.sessions s ON s.id = pj.session_id
  WHERE pj.printed_at BETWEEN COALESCE(p_from, now() - INTERVAL '30 days') AND COALESCE(p_to, now())
    AND (p_event_id IS NULL OR s.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids))
  GROUP BY 1
  ORDER BY 1 ASC;
$$;

-- Function: rpc_storage_by_event
CREATE OR REPLACE FUNCTION public.rpc_storage_by_event(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_allowed_event_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  event_id UUID,
  event_name TEXT,
  event_date DATE,
  sessions_count INT,
  expired_sessions_count INT,
  expiring_24h_count INT,
  expiring_72h_count INT,
  total_files INT,
  storage_bytes BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.id AS event_id,
    e.name AS event_name,
    e.event_date,
    COUNT(DISTINCT s.id)::INT AS sessions_count,
    COUNT(DISTINCT CASE WHEN s.status = 'kedaluwarsa' OR s.files_deleted_at IS NOT NULL THEN s.id END)::INT AS expired_sessions_count,
    COUNT(DISTINCT CASE WHEN (s.status = 'aktif' OR s.status IS NULL) AND s.files_deleted_at IS NULL AND s.expires_at BETWEEN now() AND now() + INTERVAL '24 hours' THEN s.id END)::INT AS expiring_24h_count,
    COUNT(DISTINCT CASE WHEN (s.status = 'aktif' OR s.status IS NULL) AND s.files_deleted_at IS NULL AND s.expires_at BETWEEN now() AND now() + INTERVAL '72 hours' THEN s.id END)::INT AS expiring_72h_count,
    COUNT(sa.id)::INT AS total_files,
    COALESCE(SUM(
      CASE sa.type
        WHEN 'frame_result' THEN 870000
        WHEN 'raw_photo' THEN 650000
        WHEN 'live_photo' THEN 1500000
        WHEN 'gif' THEN 1200000
        WHEN 'gif_mp4' THEN 950000
        ELSE 400000
      END
    ), 0)::BIGINT AS storage_bytes
  FROM public.events e
  LEFT JOIN public.sessions s ON s.event_id = e.id
  LEFT JOIN public.session_assets sa ON sa.session_id = s.id AND s.files_deleted_at IS NULL
  WHERE (p_event_id IS NULL OR e.id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR e.id = ANY(p_allowed_event_ids))
  GROUP BY e.id, e.name, e.event_date
  ORDER BY storage_bytes DESC, e.name ASC;
$$;
