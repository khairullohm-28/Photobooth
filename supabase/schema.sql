-- Wedding Photobooth Supabase Database Schema & RLS Policies
-- Compatible with PostgreSQL 15+

-- 1. Create tables
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  couple_names TEXT NOT NULL,
  event_date TEXT NOT NULL,
  quote_text TEXT,
  quote_source TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_settings (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  retention_hours INTEGER DEFAULT 120,
  countdown_seconds INTEGER DEFAULT 3,
  default_mirror BOOLEAN DEFAULT true,
  theme JSONB DEFAULT '{"primary_color":"#ffffff","accent_color":"#d4af37","button_radius":"9999px"}'::jsonb
);

CREATE TABLE IF NOT EXISTS screen_backgrounds (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  screen_key TEXT NOT NULL, -- 'landing','howto','frame','camera','filter','result'
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image', -- 'image','gif','video'
  blur_px INTEGER DEFAULT 8,
  overlay_opacity NUMERIC DEFAULT 0.5,
  UNIQUE(event_id, screen_key)
);

CREATE TABLE IF NOT EXISTS frames (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL, -- transparent PNG overlay
  canvas_width INTEGER DEFAULT 1200,
  canvas_height INTEGER DEFAULT 1800,
  slots JSONB NOT NULL, -- [{x, y, w, h, shot_index}]
  photo_count INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 1,
  aspect_ratio TEXT DEFAULT '2:3',
  badge TEXT
);

CREATE TABLE IF NOT EXISTS filters (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  params JSONB NOT NULL,
  sort_order INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  frame_id TEXT REFERENCES frames(id),
  filter_id TEXT REFERENCES filters(id),
  mirror BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS session_assets (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- raw_photo, retake_discarded, frame_result, live_photo, gif, gif_mp4
  url TEXT NOT NULL,
  shot_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_session_assets_session_id ON session_assets(session_id);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);

-- 3. Row Level Security (RLS)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE screen_backgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_assets ENABLE ROW LEVEL SECURITY;

-- Anonymous users (guests) can read active events, settings, backgrounds, frames, filters
CREATE POLICY "Public read active events" ON events FOR SELECT USING (is_active = true);
CREATE POLICY "Public read event_settings" ON event_settings FOR SELECT USING (true);
CREATE POLICY "Public read screen_backgrounds" ON screen_backgrounds FOR SELECT USING (true);
CREATE POLICY "Public read frames" ON frames FOR SELECT USING (true);
CREATE POLICY "Public read filters" ON filters FOR SELECT USING (true);

-- Anonymous guests can create sessions and read their session only by exact UUID
CREATE POLICY "Public insert sessions" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read single session by id" ON sessions FOR SELECT USING (
  expires_at > NOW()
);

CREATE POLICY "Public insert session_assets" ON session_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read session_assets" ON session_assets FOR SELECT USING (true);
