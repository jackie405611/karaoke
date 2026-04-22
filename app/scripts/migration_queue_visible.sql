-- Add queue_visible flag to player_state table
-- Run once in Neon SQL Editor
ALTER TABLE player_state ADD COLUMN IF NOT EXISTS queue_visible BOOLEAN NOT NULL DEFAULT true;
