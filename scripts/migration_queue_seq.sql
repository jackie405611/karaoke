-- Add queue_seq for explicit queue item versioning
-- Run once in Neon SQL Editor
ALTER TABLE queue ADD COLUMN IF NOT EXISTS queue_seq BIGINT NOT NULL DEFAULT 0;
