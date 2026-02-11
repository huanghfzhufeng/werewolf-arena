-- Batch 1: Add missing action_type enum values
ALTER TYPE "public"."action_type" ADD VALUE 'wolf_king_revenge';--> statement-breakpoint
ALTER TYPE "public"."action_type" ADD VALUE 'elder_extra_life';--> statement-breakpoint

-- Batch 1: Drop unused players.api_key column
ALTER TABLE "players" DROP COLUMN IF EXISTS "api_key";--> statement-breakpoint

-- Batch 2: Performance indexes on query hotpaths
CREATE INDEX IF NOT EXISTS "idx_agents_status" ON "agents" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agents_owner_id" ON "agents" ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_players_game_id" ON "players" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_players_agent_id" ON "players" ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_game_id" ON "messages" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_votes_game_id" ON "votes" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_actions_game_id" ON "actions" ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lobbies_status" ON "lobbies" ("status");
