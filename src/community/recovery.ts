import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games, players, agents, lobbies, lobbyMembers } from "@/db/schema";
import { createLogger } from "@/lib";

const log = createLogger("Recovery");

/**
 * Called once at engine startup.
 * Finds games stuck in "playing" status (zombie games from a previous server
 * session) and cleans them up: marks games as finished, releases agents back
 * to idle, and cleans up stale lobby state.
 */
export async function recoverZombieGames(): Promise<void> {
  const zombies = await db
    .select()
    .from(games)
    .where(eq(games.status, "playing"));

  if (zombies.length === 0) return;

  log.info(`Found ${zombies.length} zombie game(s). Recovering...`);

  for (const game of zombies) {
    try {
      // Mark game as finished
      await db
        .update(games)
        .set({
          status: "finished",
          currentPhase: "game_over",
          winner: "villager",
          finishedAt: new Date(),
        })
        .where(eq(games.id, game.id));

      // Release all agents from this game back to idle
      const gamePlayers = await db
        .select()
        .from(players)
        .where(eq(players.gameId, game.id));

      for (const player of gamePlayers) {
        if (player.agentId) {
          await db
            .update(agents)
            .set({ status: "idle", cooldownUntil: null, lastGameId: game.id })
            .where(eq(agents.id, player.agentId));
        }
      }

      // Clean up linked lobby
      const linkedLobbies = await db
        .select()
        .from(lobbies)
        .where(eq(lobbies.gameId, game.id));

      for (const lobby of linkedLobbies) {
        await db.delete(lobbyMembers).where(eq(lobbyMembers.lobbyId, lobby.id));
        await db
          .update(lobbies)
          .set({ status: "finished" })
          .where(eq(lobbies.id, lobby.id));
      }

      log.info(`Recovered game ${game.id} (${game.modeId}, round ${game.currentRound})`);
    } catch (err) {
      log.error(`Failed to recover game ${game.id}:`, err);
    }
  }

  // Also reset any agents stuck in "queued" or "playing" status
  // (they may have been mid-queue when the server died)
  const stuckQueued = await db
    .select()
    .from(agents)
    .where(eq(agents.status, "queued"));

  const stuckPlaying = await db
    .select()
    .from(agents)
    .where(eq(agents.status, "playing"));

  const stuckCount = stuckQueued.length + stuckPlaying.length;
  if (stuckCount > 0) {
    for (const agent of [...stuckQueued, ...stuckPlaying]) {
      await db
        .update(agents)
        .set({ status: "idle", cooldownUntil: null })
        .where(eq(agents.id, agent.id));
    }
    log.info(`Reset ${stuckCount} stuck agent(s) to idle.`);
  }

  // Clean up orphaned lobby members
  await db.delete(lobbyMembers);

  log.info("Recovery complete.");
}
