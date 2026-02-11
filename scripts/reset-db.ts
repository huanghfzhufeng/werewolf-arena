/**
 * Reset the database to a clean state:
 * - Remove all game data (games, players, votes, actions, messages, memories)
 * - Remove all lobbies and lobby members
 * - Keep only 20 unique agents (remove duplicates), reset status to idle
 *
 * Usage: npx tsx scripts/reset-db.ts
 */

import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  console.log("🔄 Resetting database...\n");

  // Delete in dependency order (child tables first)
  console.log("Deleting votes...");
  await db.execute(sql`DELETE FROM votes`);

  console.log("Deleting actions...");
  await db.execute(sql`DELETE FROM actions`);

  console.log("Deleting messages...");
  await db.execute(sql`DELETE FROM messages`);

  console.log("Deleting agent_memories...");
  await db.execute(sql`DELETE FROM agent_memories`);

  console.log("Deleting players...");
  await db.execute(sql`DELETE FROM players`);

  console.log("Deleting lobby_members...");
  await db.execute(sql`DELETE FROM lobby_members`);

  console.log("Deleting lobbies...");
  await db.execute(sql`DELETE FROM lobbies`);

  console.log("Deleting games...");
  await db.execute(sql`DELETE FROM games`);

  // Remove duplicate agents: keep only one per name (the earliest created)
  console.log("\nDe-duplicating agents...");
  await db.execute(sql`
    DELETE FROM agents
    WHERE id NOT IN (
      SELECT DISTINCT ON (name) id
      FROM agents
      ORDER BY name, created_at ASC
    )
  `);

  // Reset all agent status to idle
  console.log("Resetting agent status...");
  await db.execute(sql`
    UPDATE agents
    SET status = 'idle',
        cooldown_until = NULL,
        total_games = 0,
        total_wins = 0,
        win_rate = 0,
        last_game_id = NULL
  `);

  // Count remaining agents
  const result = await db.execute(sql`SELECT COUNT(*) as count FROM agents`);
  const count = (result.rows[0] as { count: string }).count;
  console.log(`\n✅ Reset complete. ${count} unique agents remaining.\n`);

  await pool.end();
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
