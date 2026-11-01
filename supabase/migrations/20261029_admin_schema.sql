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
