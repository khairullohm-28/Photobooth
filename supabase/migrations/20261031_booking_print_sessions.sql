-- ============================================================================
-- MIGRATION: 20261031_booking_print_sessions.sql
-- Fase 4: Booking (Hasil per User, Riwayat Cetak), Setting > Printer, 
-- Kode Foto Unik Transaksional, dan Purge Expired
-- ============================================================================

-- 1. Perbarui tabel SESSIONS
ALTER TABLE IF EXISTS sessions 
  ADD COLUMN IF NOT EXISTS session_code TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('aktif', 'kedaluwarsa')) DEFAULT 'aktif',
  ADD COLUMN IF NOT EXISTS printed_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS files_deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- Tambah constraint UNIQUE (event_id, session_code) jika belum ada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sessions_event_id_session_code_unique'
  ) THEN
    -- Pastikan data eksisting tidak NULL sebelum memasang UNIQUE constraint
    UPDATE sessions 
    SET session_code = 'KL-' || LPAD(SUBSTRING(id, 1, 4), 4, '0')
    WHERE session_code IS NULL;

    ALTER TABLE sessions 
      ADD CONSTRAINT sessions_event_id_session_code_unique UNIQUE (event_id, session_code);
  END IF;
END $$;

-- 2. Buat tabel EVENT_COUNTERS untuk atomic counter transaksi
CREATE TABLE IF NOT EXISTS event_counters (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  last_number INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inisialisasi counter untuk acara yang sudah ada
INSERT INTO event_counters (event_id, last_number)
SELECT id, 0 FROM events
ON CONFLICT (event_id) DO NOTHING;

-- 3. Fungsi Database Transaksional: CREATE_SESSION
-- Menjamin 2 tamu yang menekan "Lanjut Unduh" bersamaan mendapatkan nomor kode unik berbeda
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
  v_session_id TEXT;
  v_created_at TIMESTAMPTZ := NOW();
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 1. Dapatkan code_prefix dari tabel events
  SELECT COALESCE(code_prefix, 'PB') INTO v_prefix 
  FROM events 
  WHERE events.id = p_event_id;
  
  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := 'PB';
  END IF;

  -- 2. Atomic counter increment via UPDATE ... RETURNING dalam satu transaksi
  INSERT INTO event_counters (event_id, last_number, updated_at)
  VALUES (p_event_id, 1, NOW())
  ON CONFLICT (event_id)
  DO UPDATE SET 
    last_number = event_counters.last_number + 1,
    updated_at = NOW()
  RETURNING event_counters.last_number INTO v_next_val;

  -- 3. Format kode sesi: 4 digit (0001 - 9999), berlanjut ke 5+ digit jika > 9999
  IF v_next_val <= 9999 THEN
    v_code := v_prefix || '-' || LPAD(v_next_val::TEXT, 4, '0');
  ELSE
    v_code := v_prefix || '-' || v_next_val::TEXT;
  END IF;

  -- 4. Tetapkan ID sesi acak UUID (bukan dari kode foto)
  v_session_id := COALESCE(p_session_id, gen_random_uuid()::TEXT);
  v_expires_at := v_created_at + (COALESCE(p_retention_hours, 120) || ' hours')::INTERVAL;

  -- 5. Simpan baris sesi
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
    s.id,
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

-- 4. Buat tabel PRINT_PROFILES
CREATE TABLE IF NOT EXISTS print_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  paper_preset TEXT NOT NULL CHECK (paper_preset IN ('4r', '5r', 'a6', 'a5', 'a4', 'strip_2x6', 'custom')),
  paper_width_mm NUMERIC NOT NULL,
  paper_height_mm NUMERIC NOT NULL,
  orientation TEXT NOT NULL CHECK (orientation IN ('portrait', 'landscape')) DEFAULT 'portrait',
  margin_top_mm NUMERIC NOT NULL DEFAULT 0,
  margin_right_mm NUMERIC NOT NULL DEFAULT 0,
  margin_bottom_mm NUMERIC NOT NULL DEFAULT 0,
  margin_left_mm NUMERIC NOT NULL DEFAULT 0,
  fit_mode TEXT NOT NULL CHECK (fit_mode IN ('fit', 'fill', 'actual')) DEFAULT 'fill',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed profil printer bawaan jika kosong
INSERT INTO print_profiles (
  id, name, paper_preset, paper_width_mm, paper_height_mm, orientation, 
  margin_top_mm, margin_right_mm, margin_bottom_mm, margin_left_mm, fit_mode, is_default
) VALUES 
  ('prf_dnp_4r', 'DNP DS620 / Citizen CY - 4R (102x152mm)', '4r', 102, 152, 'portrait', 0, 0, 0, 0, 'fill', true),
  ('prf_epson_strip', 'Epson L805 - Strip 2x6 (51x152mm)', 'strip_2x6', 51, 152, 'portrait', 2, 2, 2, 2, 'fit', false),
  ('prf_canon_selphy', 'Canon Selphy CP1500 - Postcard 4R', '4r', 100, 148, 'portrait', 3, 3, 3, 3, 'fill', false),
  ('prf_a5_glossy', 'A5 Glossy Photo Paper (148x210mm)', 'a5', 148, 210, 'portrait', 4, 4, 4, 4, 'fit', false),
  ('prf_a4_standard', 'A4 Studio Standard (210x297mm)', 'a4', 210, 297, 'portrait', 5, 5, 5, 5, 'fit', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Buat tabel PRINT_JOBS
CREATE TABLE IF NOT EXISTS print_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES print_profiles(id) ON DELETE SET NULL,
  copies INT NOT NULL DEFAULT 1,
  printed_by TEXT,
  printed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_session ON print_jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_time ON print_jobs(printed_at DESC);

-- 6. Row Level Security (RLS)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- Policy sessions:
-- Admin berizin booking dapat membaca semua sesi
CREATE POLICY "Admin berizin booking dapat melihat sesi"
  ON sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles ap
      WHERE ap.id = auth.uid()
        AND (
          ap.role = 'owner'
          OR ap.permissions @> ARRAY['*']::text[]
          OR ap.permissions @> ARRAY['booking']::text[]
          OR ap.permissions @> ARRAY['booking.results']::text[]
        )
        AND (
          ap.allowed_event_ids IS NULL 
          OR sessions.event_id = ANY(ap.allowed_event_ids)
        )
    )
  );

-- Tamu anonim dapat membaca sesi miliknya via UUID session id
CREATE POLICY "Tamu membaca sesi sendiri via id"
  ON sessions FOR SELECT
  USING (true);

-- Tamu dapat membuat sesi baru
CREATE POLICY "Tamu membuat sesi"
  ON sessions FOR INSERT
  WITH CHECK (true);

-- Policy session_assets:
CREATE POLICY "Akses publik membaca aset"
  ON session_assets FOR SELECT
  USING (true);

CREATE POLICY "Menyimpan aset sesi"
  ON session_assets FOR INSERT
  WITH CHECK (true);

-- Policy print_profiles:
CREATE POLICY "Semua dapat membaca print profiles"
  ON print_profiles FOR SELECT
  USING (true);

CREATE POLICY "Admin dapat mengelola print profiles"
  ON print_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles ap
      WHERE ap.id = auth.uid()
        AND (ap.role = 'owner' OR ap.permissions @> ARRAY['settings']::text[] OR ap.permissions @> ARRAY['settings.printer']::text[])
    )
  );

-- Policy print_jobs:
CREATE POLICY "Admin berizin booking membaca print jobs"
  ON print_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_profiles ap
      WHERE ap.id = auth.uid()
        AND (ap.role = 'owner' OR ap.permissions @> ARRAY['booking']::text[] OR ap.permissions @> ARRAY['booking.print_history']::text[])
    )
  );

CREATE POLICY "Admin berizin booking mencatat print jobs"
  ON print_jobs FOR INSERT
  WITH CHECK (true);

-- 7. SQL JADWAL pg_cron UNTUK PENGHAPUSAN OTOMATIS (PURGE EXPIRED)
-- Salin perintah ini ke SQL Editor di Supabase Dashboard (Database -> Extensions -> pg_cron):
/*
-- Aktifkan ekstensi pg_cron dan pg_net jika belum aktif:
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Jadwalkan pembersihan setiap jam:
SELECT cron.schedule(
  'purge-expired-sessions-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/purge-expired',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE-ROLE-KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
*/
