-- Migration: Add multi-room support
-- Run this once in Neon SQL Editor: https://console.neon.tech → SQL Editor

-- ── Step 1: Create rooms table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id             BIGSERIAL PRIMARY KEY,
  code           CHAR(6)     NOT NULL UNIQUE,
  host_token     TEXT        NOT NULL UNIQUE,
  name           TEXT        NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rooms_code        ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_last_active ON rooms(last_active_at);

-- ── Step 2: Insert a "legacy" room for all existing data ──────────────────
INSERT INTO rooms (code, host_token, name)
VALUES (
  'LEGACY',
  replace(gen_random_uuid()::text, '-', ''),
  'Default Room'
)
ON CONFLICT (code) DO NOTHING;

-- ── Step 3: Add room_id columns (nullable first for backfill) ─────────────
ALTER TABLE queue     ADD COLUMN IF NOT EXISTS room_id BIGINT REFERENCES rooms(id) ON DELETE CASCADE;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS room_id BIGINT REFERENCES rooms(id) ON DELETE CASCADE;

-- ── Step 4: Backfill existing rows to the legacy room ─────────────────────
UPDATE queue     SET room_id = (SELECT id FROM rooms WHERE code = 'LEGACY') WHERE room_id IS NULL;
UPDATE playlists SET room_id = (SELECT id FROM rooms WHERE code = 'LEGACY') WHERE room_id IS NULL;

-- ── Step 5: Make room_id NOT NULL ─────────────────────────────────────────
ALTER TABLE queue     ALTER COLUMN room_id SET NOT NULL;
ALTER TABLE playlists ALTER COLUMN room_id SET NOT NULL;

-- ── Step 6: Add room-scoped indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_queue_room_status ON queue(room_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_room_order  ON queue(room_id, queue_order);
CREATE INDEX IF NOT EXISTS idx_playlists_room    ON playlists(room_id);

-- ── Step 7: Migrate player_state to per-room rows ────────────────────────
DROP TABLE IF EXISTS player_state;

CREATE TABLE player_state (
  room_id    BIGINT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  command    TEXT NOT NULL DEFAULT 'play' CHECK(command IN ('play', 'pause', 'restart')),
  seq        BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert legacy room's initial player state
INSERT INTO player_state (room_id)
SELECT id FROM rooms WHERE code = 'LEGACY'
ON CONFLICT DO NOTHING;

-- ── Done ─────────────────────────────────────────────────────────────────
-- The legacy room is accessible at:
--   /{host}/LEGACY        (host admin)
--   /{host}/LEGACY/display (display screen)
--   /{host}/LEGACY/remote  (guest remote)
