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
