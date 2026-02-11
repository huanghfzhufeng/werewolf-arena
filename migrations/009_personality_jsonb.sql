-- Migration: Convert personality columns from text to jsonb
-- Prerequisite: All existing personality values must be valid JSON strings.
-- Run with: psql $DATABASE_URL -f migrations/009_personality_jsonb.sql

BEGIN;

-- agents.personality: text → jsonb
ALTER TABLE agents
  ALTER COLUMN personality TYPE jsonb USING personality::jsonb;

-- players.personality: text → jsonb
ALTER TABLE players
  ALTER COLUMN personality TYPE jsonb USING personality::jsonb;

COMMIT;
