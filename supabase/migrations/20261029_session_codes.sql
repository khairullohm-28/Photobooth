-- Migration 20261029_session_codes: Atomic Session Code Generation
-- Format: {events.code_prefix}-{4-digit incremental counter} (e.g. MND-0042, KL-0001)

-- 1. Add code_prefix column to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS code_prefix TEXT DEFAULT 'PB';

-- 2. Add session_code, status, printed_count, files_deleted_at to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_code TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aktif';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS printed_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS files_deleted_at TIMESTAMPTZ;

-- 3. Ensure unique constraint for (event_id, session_code)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_event_id_session_code_key'
  ) THEN
    ALTER TABLE sessions ADD CONSTRAINT sessions_event_id_session_code_key UNIQUE (event_id, session_code);
  END IF;
END $$;

-- 4. Event Counters Table for Atomic Sequence per Event
CREATE TABLE IF NOT EXISTS event_counters (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- 5. Atomic function to generate code and create session in single transaction
CREATE OR REPLACE FUNCTION create_session_with_code(
  p_session_id UUID,
  p_event_id TEXT,
  p_code_prefix TEXT,
  p_frame_id TEXT,
  p_filter_id TEXT,
  p_mirror BOOLEAN,
  p_expires_at TIMESTAMPTZ
) RETURNS TABLE (
  session_id UUID,
  session_code TEXT
) LANGUAGE plpgsql AS $$
DECLARE
  v_next_num INTEGER;
  v_code TEXT;
  v_prefix TEXT;
BEGIN
  -- Normalize prefix
  v_prefix := COALESCE(NULLIF(TRIM(p_code_prefix), ''), 'PB');

  -- Atomic increment
  INSERT INTO event_counters (event_id, last_number)
  VALUES (p_event_id, 1)
  ON CONFLICT (event_id)
  DO UPDATE SET last_number = event_counters.last_number + 1
  RETURNING last_number INTO v_next_num;

  -- Format e.g. KL-0001 (pads to at least 4 digits, advances to 5+ if needed)
  v_code := UPPER(v_prefix) || '-' || LPAD(v_next_num::TEXT, 4, '0');

  -- Insert session
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
    expires_at
  ) VALUES (
    p_session_id,
    p_event_id,
    v_code,
    p_frame_id,
    p_filter_id,
    p_mirror,
    'aktif',
    0,
    NOW(),
    p_expires_at
  );

  RETURN QUERY SELECT p_session_id, v_code;
END;
$$;
