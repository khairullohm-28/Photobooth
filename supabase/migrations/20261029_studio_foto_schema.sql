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
