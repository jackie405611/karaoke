-- Run this once in the Neon SQL Editor before first deployment
-- https://console.neon.tech → your project → SQL Editor

CREATE TABLE IF NOT EXISTS videos (
  id               BIGSERIAL PRIMARY KEY,
  youtube_video_id TEXT UNIQUE NOT NULL,
  title            TEXT NOT NULL,
  thumbnail        TEXT NOT NULL,
  duration         TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS queue (
  id          BIGSERIAL PRIMARY KEY,
  room_id     BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  video_id    BIGINT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  queue_order INTEGER NOT NULL DEFAULT 0,
  queue_seq   BIGINT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','playing','done')),
  requested_by TEXT NOT NULL DEFAULT 'Guest',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_queue_room_status ON queue(room_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_room_order  ON queue(room_id, queue_order);

CREATE TABLE IF NOT EXISTS playlists (
  id          BIGSERIAL PRIMARY KEY,
  room_id     BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_playlists_room ON playlists(room_id);

CREATE TABLE IF NOT EXISTS playlist_items (
  id          BIGSERIAL PRIMARY KEY,
  playlist_id BIGINT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  video_id    BIGINT NOT NULL REFERENCES videos(id)    ON DELETE CASCADE,
  item_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(playlist_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id);

-- Per-room player state (replaces global singleton)
CREATE TABLE IF NOT EXISTS player_state (
  room_id    BIGINT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  command    TEXT NOT NULL DEFAULT 'play' CHECK(command IN ('play', 'pause', 'restart')),
  seq        BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
