-- Migration 20261029: Admin Dashboard & Multi-Event Management Schema
-- Compatible with Supabase PostgreSQL 15+

-- 1. App Settings (Branding & Dynamic UI Colors)
CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT 'Wedding Memories Studio',
  logo_url TEXT,
  favicon_url TEXT,
  ui_colors JSONB NOT NULL DEFAULT '{"primary": "#121212", "sidebar_bg": "#EBEBEB", "accent": "#d4af37", "text": "#121212"}'::jsonb,
  font TEXT NOT NULL DEFAULT 'Libre Baskerville',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default app_settings row if not exists
INSERT INTO app_settings (id, company_name, ui_colors, font)
VALUES (
  1,
  'Khai & Lila Wedding Studio',
  '{"primary": "#121212", "sidebar_bg": "#EBEBEB", "accent": "#d4af37", "text": "#121212"}'::jsonb,
  'Libre Baskerville'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Admin Profiles (RBAC & Event Scoping)
CREATE TABLE IF NOT EXISTS admin_profiles (
  id TEXT PRIMARY KEY, -- maps to auth.users.id or custom UUID
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'team')),
  permissions TEXT[] NOT NULL DEFAULT '{}',
  allowed_event_ids TEXT[] DEFAULT NULL, -- NULL = access to all events
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Template Categories (Phase 2 foundation)
CREATE TABLE IF NOT EXISTS template_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial template category
INSERT INTO template_categories (id, name)
VALUES ('cat_classic', 'Classic Wedding Series')
ON CONFLICT (id) DO NOTHING;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;

-- App settings: Anyone can read branding columns
CREATE POLICY "Public read app_settings" ON app_settings
  FOR SELECT USING (true);

-- Only authenticated admins can update app_settings
CREATE POLICY "Admin update app_settings" ON app_settings
  FOR UPDATE USING (true);

-- Admin profiles: Public can read for auth checking
CREATE POLICY "Allow read admin_profiles" ON admin_profiles
  FOR SELECT USING (true);

CREATE POLICY "Admin manage admin_profiles" ON admin_profiles
  FOR ALL USING (true);

-- Audit logs: readable by admins, insertable
CREATE POLICY "Allow read audit_logs" ON audit_logs
  FOR SELECT USING (true);

CREATE POLICY "Allow insert audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read template_categories" ON template_categories
  FOR SELECT USING (true);
-- Migration: Studio Foto (Template Categories & Frames)
-- Compatible with PostgreSQL 15+

-- 1. Ensure template_categories table exists with unique name
CREATE TABLE IF NOT EXISTS template_categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add template_category_id to events if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'template_category_id'
  ) THEN
    ALTER TABLE events ADD COLUMN template_category_id TEXT REFERENCES template_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Enhance or recreate frames table with category_id and rotation support
DO $$
BEGIN
  -- If frames table exists, ensure all columns exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'frames') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'frames' AND column_name = 'category_id') THEN
      ALTER TABLE frames ADD COLUMN category_id TEXT REFERENCES template_categories(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'frames' AND column_name = 'preview_url') THEN
      ALTER TABLE frames ADD COLUMN preview_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'frames' AND column_name = 'thumbnail_url') THEN
      ALTER TABLE frames ADD COLUMN thumbnail_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'frames' AND column_name = 'is_active') THEN
      ALTER TABLE frames ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'frames' AND column_name = 'is_archived') THEN
      ALTER TABLE frames ADD COLUMN is_archived BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'frames' AND column_name = 'created_at') THEN
      ALTER TABLE frames ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  ELSE
    CREATE TABLE frames (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES template_categories(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      preview_url TEXT,
      thumbnail_url TEXT,
      canvas_width INTEGER DEFAULT 1200,
      canvas_height INTEGER DEFAULT 1800,
      slots JSONB NOT NULL,
      photo_count INTEGER NOT NULL,
      is_active BOOLEAN DEFAULT true,
      is_archived BOOLEAN DEFAULT false,
      sort_order INTEGER DEFAULT 1,
      aspect_ratio TEXT DEFAULT '2:3',
      badge TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 4. Migrate old frames with event_id into categories
DO $$
DECLARE
  rec RECORD;
  cat_id TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'frames' AND column_name = 'event_id') THEN
    FOR rec IN SELECT DISTINCT event_id FROM frames WHERE event_id IS NOT NULL AND category_id IS NULL LOOP
      cat_id := 'cat_' || rec.event_id;
      INSERT INTO template_categories (id, name)
      VALUES (cat_id, 'Kategori ' || rec.event_id)
      ON CONFLICT (id) DO NOTHING;

      UPDATE frames SET category_id = cat_id WHERE event_id = rec.event_id AND category_id IS NULL;
      UPDATE events SET template_category_id = cat_id WHERE id = rec.event_id AND template_category_id IS NULL;
    END LOOP;
  END IF;
END $$;

-- 5. Storage bucket 'frames' and RLS policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('frames', 'frames', true)
ON CONFLICT (id) DO NOTHING;

-- Public can read frames bucket
CREATE POLICY "Public read frames bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'frames');

-- Only admins can insert/update/delete frames bucket
CREATE POLICY "Admin manage frames bucket" ON storage.objects
  FOR ALL USING (
    bucket_id = 'frames' AND
    auth.role() = 'authenticated'
  );

-- RLS policies for template_categories and frames
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read template_categories" ON template_categories
  FOR SELECT USING (true);

CREATE POLICY "Admin manage template_categories" ON template_categories
  FOR ALL USING (true);

CREATE POLICY "Public read active frames" ON frames
  FOR SELECT USING (is_active = true AND is_archived = false);

CREATE POLICY "Admin manage frames" ON frames
  FOR ALL USING (true);
-- Migration: Filters 3D LUT Schema & Storage
-- Compatible with PostgreSQL 15+

-- 1. Create or alter filters table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'filters') THEN
    -- Add new columns if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'filters' AND column_name = 'lut_url') THEN
      ALTER TABLE filters ADD COLUMN lut_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'filters' AND column_name = 'lut_png_url') THEN
      ALTER TABLE filters ADD COLUMN lut_png_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'filters' AND column_name = 'lut_size') THEN
      ALTER TABLE filters ADD COLUMN lut_size INTEGER DEFAULT 33;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'filters' AND column_name = 'intensity_default') THEN
      ALTER TABLE filters ADD COLUMN intensity_default INTEGER DEFAULT 100;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'filters' AND column_name = 'is_active') THEN
      ALTER TABLE filters ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'filters' AND column_name = 'is_archived') THEN
      ALTER TABLE filters ADD COLUMN is_archived BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'filters' AND column_name = 'extra_effects') THEN
      ALTER TABLE filters ADD COLUMN extra_effects JSONB DEFAULT '{"grain":0,"softness":0,"vignette":0}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'filters' AND column_name = 'created_at') THEN
      ALTER TABLE filters ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Make event_id nullable since filters are now global
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'filters' AND column_name = 'event_id' AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE filters ALTER COLUMN event_id DROP NOT NULL;
    END IF;
  ELSE
    CREATE TABLE filters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      lut_url TEXT,
      lut_png_url TEXT,
      lut_size INTEGER DEFAULT 33,
      intensity_default INTEGER DEFAULT 100,
      thumbnail_url TEXT,
      is_active BOOLEAN DEFAULT true,
      is_archived BOOLEAN DEFAULT false,
      sort_order INTEGER DEFAULT 1,
      extra_effects JSONB DEFAULT '{"grain":0,"softness":0,"vignette":0}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 2. Storage bucket 'luts' and security policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('luts', 'luts', true)
ON CONFLICT (id) DO NOTHING;

-- Public can read luts bucket
CREATE POLICY "Public read luts bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'luts');

-- Only admins can manage luts bucket
CREATE POLICY "Admins manage luts bucket" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'luts' AND
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE admin_profiles.id = auth.uid()
      AND (
        admin_profiles.role = 'owner'
        OR 'studio_foto' = ANY(admin_profiles.permissions)
      )
    )
  );
-- Migration: User / Acara Pernikahan (Events, Settings, Filters, Backgrounds)
-- Compatible with PostgreSQL 15+

-- 1. Ensure events table exists and has all required columns
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  code_prefix VARCHAR(10) UNIQUE NOT NULL,
  event_date TEXT NOT NULL,
  couple_names TEXT NOT NULL,
  quote_text TEXT,
  quote_source TEXT,
  template_category_id TEXT REFERENCES template_categories(id) ON DELETE SET NULL,
  active_from TIMESTAMPTZ,
  active_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif', 'selesai')),
  is_demo BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add any missing columns if events already existed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'name') THEN
    ALTER TABLE events ADD COLUMN name TEXT;
    UPDATE events SET name = couple_names WHERE name IS NULL;
    ALTER TABLE events ALTER COLUMN name SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'code_prefix') THEN
    ALTER TABLE events ADD COLUMN code_prefix VARCHAR(10);
    UPDATE events SET code_prefix = UPPER(SUBSTRING(slug FROM 1 FOR 3)) WHERE code_prefix IS NULL;
    ALTER TABLE events ADD CONSTRAINT events_code_prefix_unique UNIQUE (code_prefix);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'status') THEN
    ALTER TABLE events ADD COLUMN status TEXT DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif', 'selesai'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'active_from') THEN
    ALTER TABLE events ADD COLUMN active_from TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'active_until') THEN
    ALTER TABLE events ADD COLUMN active_until TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'is_demo') THEN
    ALTER TABLE events ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'created_at') THEN
    ALTER TABLE events ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 2. Ensure event_settings table exists
CREATE TABLE IF NOT EXISTS event_settings (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  retention_hours INTEGER NOT NULL DEFAULT 120,
  countdown_seconds INTEGER NOT NULL DEFAULT 3,
  default_mirror BOOLEAN NOT NULL DEFAULT true,
  theme JSONB DEFAULT '{"primary_color":"#ffffff","accent_color":"#d4af37","button_radius":"9999px"}'::jsonb
);

-- 3. Ensure event_filters table exists (mapping allowed filters per event)
CREATE TABLE IF NOT EXISTS event_filters (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  filter_id TEXT NOT NULL REFERENCES filters(id) ON DELETE CASCADE,
  UNIQUE(event_id, filter_id)
);

-- 4. Ensure screen_backgrounds table exists
CREATE TABLE IF NOT EXISTS screen_backgrounds (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  screen_key TEXT NOT NULL CHECK (screen_key IN ('landing', 'howto', 'frame', 'camera', 'filter', 'result')),
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'gif', 'video')),
  blur_px INTEGER NOT NULL DEFAULT 0,
  overlay_opacity NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
  UNIQUE(event_id, screen_key)
);

-- 5. Storage bucket 'backgrounds' and RLS policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('backgrounds', 'backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Public can read backgrounds bucket
CREATE POLICY "Public read backgrounds bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'backgrounds');

-- Only admins can manage backgrounds bucket
CREATE POLICY "Admins manage backgrounds bucket" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'backgrounds' AND
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE admin_profiles.id = auth.uid()
      AND (
        admin_profiles.role = 'owner'
        OR 'events' = ANY(admin_profiles.permissions)
      )
    )
  );

-- 6. Insert demo event "Wedding Khai & Lila" if not exists
INSERT INTO events (
  id, name, slug, code_prefix, event_date, couple_names,
  quote_text, quote_source, is_demo, is_active, status, template_category_id
)
VALUES (
  'evt_khai_lila_2026',
  'Wedding Khai & Lila',
  'khai-lila',
  'KL',
  '28 Oktober 2026',
  'Khai & Lila',
  'Dan di antara tanda-tanda (kebesaran)-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.',
  'QS. Ar-Rum: 21',
  true,
  true,
  'aktif',
  'cat_khai_lila'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code_prefix = EXCLUDED.code_prefix,
  status = 'aktif';

INSERT INTO event_settings (event_id, retention_hours, countdown_seconds, default_mirror)
VALUES ('evt_khai_lila_2026', 120, 3, true)
ON CONFLICT (event_id) DO NOTHING;
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
