-- ============================================================================
-- RPC FUNCTIONS & TRANSACTIONAL LOGIC FOR PHOTOBOOTH
-- Jalankan ini di SQL Editor Supabase untuk mengaktifkan fungsi server-side
-- ============================================================================

-- 1. Penambahan kolom pendukung (jika belum ada)
ALTER TABLE IF EXISTS event_counters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Fungsi Transaksional Atomic Session Creator
-- Menjamin 2 tamu yang menekan "Lanjut Unduh" bersamaan mendapatkan nomor kode unik berurutan
CREATE OR REPLACE FUNCTION create_session(
  p_event_id TEXT,
  p_frame_id TEXT,
  p_filter_id TEXT,
  p_mirror BOOLEAN DEFAULT true,
  p_session_id TEXT DEFAULT NULL,
  p_retention_hours INT DEFAULT 120,
  p_is_demo BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id TEXT,
  event_id TEXT,
  session_code TEXT,
  frame_id TEXT,
  filter_id TEXT,
  mirror BOOLEAN,
  status TEXT,
  printed_count INT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_demo BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix TEXT;
  v_next_val INT;
  v_code TEXT;
  v_session_id UUID;
  v_created_at TIMESTAMPTZ := NOW();
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Dapatkan code_prefix dari event
  SELECT COALESCE(code_prefix, 'PB') INTO v_prefix 
  FROM events 
  WHERE events.id = p_event_id;
  
  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := 'PB';
  END IF;

  -- Atomic counter increment
  INSERT INTO event_counters (event_id, last_number, updated_at)
  VALUES (p_event_id, 1, NOW())
  ON CONFLICT (event_id)
  DO UPDATE SET 
    last_number = event_counters.last_number + 1,
    updated_at = NOW()
  RETURNING event_counters.last_number INTO v_next_val;

  -- Format nomor kode (4 digit atau 5+ digit)
  IF v_next_val <= 9999 THEN
    v_code := v_prefix || '-' || LPAD(v_next_val::TEXT, 4, '0');
  ELSE
    v_code := v_prefix || '-' || v_next_val::TEXT;
  END IF;

  IF p_session_id IS NOT NULL AND p_session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_session_id := p_session_id::UUID;
  ELSE
    v_session_id := gen_random_uuid();
  END IF;

  v_expires_at := v_created_at + (COALESCE(p_retention_hours, 120) || ' hours')::INTERVAL;

  INSERT INTO sessions (
    id,
    event_id,
    session_code,
    frame_id,
    filter_id,
    mirror,
    status,
    printed_count,
    created_at,
    expires_at,
    is_demo
  ) VALUES (
    v_session_id,
    p_event_id,
    v_code,
    p_frame_id,
    p_filter_id,
    p_mirror,
    'aktif',
    0,
    v_created_at,
    v_expires_at,
    p_is_demo
  );

  RETURN QUERY
  SELECT 
    s.id::TEXT,
    s.event_id,
    s.session_code,
    s.frame_id,
    s.filter_id,
    s.mirror,
    s.status,
    s.printed_count,
    s.created_at,
    s.expires_at,
    s.is_demo
  FROM sessions s
  WHERE s.id = v_session_id;
END;
$$;

-- 3. RPC Summary Dashboard
CREATE OR REPLACE FUNCTION rpc_dashboard_summary(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_event_id TEXT DEFAULT NULL,
  p_allowed_event_ids TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_from TIMESTAMPTZ := COALESCE(p_from, NOW() - INTERVAL '30 days');
  v_to TIMESTAMPTZ := COALESCE(p_to, NOW());
  v_active_events INT;
  v_total_sessions INT;
  v_total_photos INT;
  v_total_prints INT;
  v_avg_retakes NUMERIC;
  v_storage_bytes BIGINT;
  v_expiring_24h INT;
BEGIN
  -- Acara aktif
  SELECT COUNT(*) INTO v_active_events
  FROM events
  WHERE status = 'aktif'
    AND (p_event_id IS NULL OR id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR id = ANY(p_allowed_event_ids));

  -- Sesi
  SELECT COUNT(*) INTO v_total_sessions
  FROM sessions
  WHERE created_at BETWEEN v_from AND v_to
    AND (p_event_id IS NULL OR event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR event_id = ANY(p_allowed_event_ids));

  -- Foto mentah
  SELECT COUNT(*) INTO v_total_photos
  FROM session_assets sa
  JOIN sessions s ON sa.session_id = s.id
  WHERE sa.type = 'raw_photo'
    AND s.created_at BETWEEN v_from AND v_to
    AND (p_event_id IS NULL OR s.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids));

  -- Cetak
  SELECT COALESCE(SUM(pj.copies), 0) INTO v_total_prints
  FROM print_jobs pj
  WHERE pj.printed_at BETWEEN v_from AND v_to
    AND (p_event_id IS NULL OR pj.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR pj.event_id = ANY(p_allowed_event_ids));

  -- Retake
  WITH retake_counts AS (
    SELECT s.id, COUNT(sa.id) AS retakes
    FROM sessions s
    LEFT JOIN session_assets sa ON sa.session_id = s.id AND sa.type = 'retake_discarded'
    WHERE s.created_at BETWEEN v_from AND v_to
      AND (p_event_id IS NULL OR s.event_id = p_event_id)
      AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids))
    GROUP BY s.id
  )
  SELECT COALESCE(ROUND(AVG(retakes), 1), 0) INTO v_avg_retakes FROM retake_counts;

  -- Estimasi Storage
  SELECT COALESCE(SUM(
    CASE 
      WHEN sa.type = 'frame_result' THEN 870000
      WHEN sa.type = 'raw_photo' THEN 650000
      WHEN sa.type = 'live_photo' THEN 1500000
      WHEN sa.type = 'gif' THEN 1200000
      WHEN sa.type = 'gif_mp4' THEN 950000
      ELSE 400000
    END
  ), 0) INTO v_storage_bytes
  FROM session_assets sa
  JOIN sessions s ON sa.session_id = s.id
  WHERE s.files_deleted_at IS NULL
    AND (p_event_id IS NULL OR s.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids));

  -- Sesi kedaluwarsa dlm 24 jam
  SELECT COUNT(*) INTO v_expiring_24h
  FROM sessions
  WHERE files_deleted_at IS NULL
    AND status != 'kedaluwarsa'
    AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
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

-- 4. RPC Top Templates
CREATE OR REPLACE FUNCTION rpc_top_templates(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_event_id TEXT DEFAULT NULL,
  p_allowed_event_ids TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  template_id TEXT,
  template_name TEXT,
  thumbnail_url TEXT,
  usage_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    f.id AS template_id,
    f.name AS template_name,
    COALESCE(f.preview_url, f.image_url) AS thumbnail_url,
    COUNT(s.id) AS usage_count
  FROM frames f
  LEFT JOIN sessions s ON s.frame_id = f.id
    AND s.created_at BETWEEN COALESCE(p_from, NOW() - INTERVAL '30 days') AND COALESCE(p_to, NOW())
    AND (p_event_id IS NULL OR s.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids))
  GROUP BY f.id, f.name, f.preview_url, f.image_url
  ORDER BY usage_count DESC, f.name ASC;
$$;

-- 5. RPC Top Filters
CREATE OR REPLACE FUNCTION rpc_top_filters(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_event_id TEXT DEFAULT NULL,
  p_allowed_event_ids TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  filter_id TEXT,
  filter_name TEXT,
  usage_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    fl.id AS filter_id,
    fl.name AS filter_name,
    COUNT(s.id) AS usage_count
  FROM filters fl
  LEFT JOIN sessions s ON s.filter_id = fl.id
    AND s.created_at BETWEEN COALESCE(p_from, NOW() - INTERVAL '30 days') AND COALESCE(p_to, NOW())
    AND (p_event_id IS NULL OR s.event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR s.event_id = ANY(p_allowed_event_ids))
  GROUP BY fl.id, fl.name
  ORDER BY usage_count DESC, fl.name ASC;
$$;

-- 6. RPC Funnel Konversi
CREATE OR REPLACE FUNCTION rpc_funnel(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_event_id TEXT DEFAULT NULL,
  p_allowed_event_ids TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_from TIMESTAMPTZ := COALESCE(p_from, NOW() - INTERVAL '30 days');
  v_to TIMESTAMPTZ := COALESCE(p_to, NOW());
  v_start BIGINT := 0;
  v_frame BIGINT := 0;
  v_photos BIGINT := 0;
  v_filter BIGINT := 0;
  v_download BIGINT := 0;
BEGIN
  SELECT 
    COALESCE(COUNT(*) FILTER (WHERE step = 'start'), 0),
    COALESCE(COUNT(*) FILTER (WHERE step = 'frame'), 0),
    COALESCE(COUNT(*) FILTER (WHERE step = 'photos_done'), 0),
    COALESCE(COUNT(*) FILTER (WHERE step = 'filter'), 0),
    COALESCE(COUNT(*) FILTER (WHERE step = 'download'), 0)
  INTO v_start, v_frame, v_photos, v_filter, v_download
  FROM analytics_events
  WHERE created_at BETWEEN v_from AND v_to
    AND (p_event_id IS NULL OR event_id = p_event_id)
    AND (p_allowed_event_ids IS NULL OR event_id = ANY(p_allowed_event_ids));

  RETURN jsonb_build_array(
    jsonb_build_object('step_key', 'start', 'label', 'Mulai', 'count', v_start, 'drop_off_pct', 0),
    jsonb_build_object('step_key', 'frame', 'label', 'Pilih Frame', 'count', v_frame, 'drop_off_pct', CASE WHEN v_start > 0 THEN ROUND(((v_start - v_frame)::NUMERIC / v_start) * 100, 1) ELSE 0 END),
    jsonb_build_object('step_key', 'photos_done', 'label', 'Foto Selesai', 'count', v_photos, 'drop_off_pct', CASE WHEN v_frame > 0 THEN ROUND(((v_frame - v_photos)::NUMERIC / v_frame) * 100, 1) ELSE 0 END),
    jsonb_build_object('step_key', 'filter', 'label', 'Pilih Filter', 'count', v_filter, 'drop_off_pct', CASE WHEN v_photos > 0 THEN ROUND(((v_photos - v_filter)::NUMERIC / v_photos) * 100, 1) ELSE 0 END),
    jsonb_build_object('step_key', 'download', 'label', 'Unduh Softfile', 'count', v_download, 'drop_off_pct', CASE WHEN v_filter > 0 THEN ROUND(((v_filter - v_download)::NUMERIC / v_filter) * 100, 1) ELSE 0 END)
  );
END;
$$;
