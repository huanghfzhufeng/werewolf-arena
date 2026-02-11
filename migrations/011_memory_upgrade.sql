-- 011: Memory system upgrade + social posts
CREATE EXTENSION IF NOT EXISTS vector;

-- New memory source: self-note
ALTER TYPE memory_source ADD VALUE IF NOT EXISTS 'self-note';

-- Embedding column for hybrid search (pgvector)
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Social posts table
CREATE TYPE post_type AS ENUM ('reflection', 'impression', 'reply');

CREATE TABLE IF NOT EXISTS agent_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  type post_type NOT NULL,
  parent_id UUID,
  game_id UUID REFERENCES games(id),
  target_agent_id UUID REFERENCES agents(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_posts_agent ON agent_posts(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_posts_parent ON agent_posts(parent_id);
CREATE INDEX IF NOT EXISTS idx_agent_posts_created ON agent_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_posts_game ON agent_posts(game_id);
