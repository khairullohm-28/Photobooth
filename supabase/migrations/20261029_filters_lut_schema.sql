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
