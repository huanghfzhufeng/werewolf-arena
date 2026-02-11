import { eq, and, lt, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  games,
  players,
  messages,
  votes,
  actions,
  agents,
  lobbies,
  lobbyMembers,
} from "@/db/schema";
import { createLogger } from "@/lib";

const log = createLogger("DataCleanup");

const GAME_RETENTION_DAYS = 30;
const DORMANT_AGENT_RETENTION_DAYS = 90;
const LOBBY_RETENTION_DAYS = 7;

// Run cleanup every ~120 ticks (~1 hour at 30s tick interval)
const TICKS_PER_CLEANUP = 120;
let tickCounter = 0;

/**
 * Called from lifecycleTick. Runs actual cleanup only once per hour.
 */
export async function maybeRunCleanup(): Promise<void> {
  tickCounter++;
  if (tickCounter < TICKS_PER_CLEANUP) return;
  tickCounter = 0;

  try {
    await cleanupOldGames();
    await cleanupDormantAgents();
    await cleanupOldLobbies();
  } catch (err) {
    log.error("Cleanup error:", err);
  }
}

/**
 * Delete finished games older than GAME_RETENTION_DAYS,
 * along with all related child rows.
 */
async function cleanupOldGames(): Promise<void> {
  const cutoff = new Date(Date.now() - GAME_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const oldGames = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.status, "finished"), lt(games.finishedAt, cutoff)));

  if (oldGames.length === 0) return;

  const gameIds = oldGames.map((g) => g.id);

  // Find player IDs for these games (needed for FK on votes/actions/messages)
  const gamePlayers = await db
    .select({ id: players.id })
    .from(players)
    .where(inArray(players.gameId, gameIds));
  const playerIds = gamePlayers.map((p) => p.id);

  // Delete child tables first (respect FK constraints)
  if (playerIds.length > 0) {
    await db.delete(votes).where(inArray(votes.voterId, playerIds));
    await db.delete(actions).where(inArray(actions.gameId, gameIds));
  }
  await db.delete(messages).where(inArray(messages.gameId, gameIds));
  await db.delete(players).where(inArray(players.gameId, gameIds));
  await db.delete(games).where(inArray(games.id, gameIds));

  log.info(`Cleaned up ${gameIds.length} old game(s) and related data.`);
}

/**
 * Delete agents that have been dormant for over DORMANT_AGENT_RETENTION_DAYS
 * and have zero games played (to avoid losing player history).
 */
async function cleanupDormantAgents(): Promise<void> {
  const cutoff = new Date(Date.now() - DORMANT_AGENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const staleAgents = await db
    .select({ id: agents.id })
    .from(agents)
    .where(
      and(
        eq(agents.status, "dormant"),
        eq(agents.isSystem, false),
        eq(agents.totalGames, 0),
        lt(agents.createdAt, cutoff)
      )
    );

  if (staleAgents.length === 0) return;
  const agentIds = staleAgents.map((a) => a.id);

  // Remove from lobby_members first
  await db.delete(lobbyMembers).where(inArray(lobbyMembers.agentId, agentIds));
  await db.delete(agents).where(inArray(agents.id, agentIds));

  log.info(`Cleaned up ${agentIds.length} stale dormant agent(s).`);
}

/**
 * Delete finished lobbies older than LOBBY_RETENTION_DAYS.
 */
async function cleanupOldLobbies(): Promise<void> {
  const cutoff = new Date(Date.now() - LOBBY_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const oldLobbies = await db
    .select({ id: lobbies.id })
    .from(lobbies)
    .where(and(eq(lobbies.status, "finished"), lt(lobbies.createdAt, cutoff)));

  if (oldLobbies.length === 0) return;
  const lobbyIds = oldLobbies.map((l) => l.id);

  await db.delete(lobbyMembers).where(inArray(lobbyMembers.lobbyId, lobbyIds));
  await db.delete(lobbies).where(inArray(lobbies.id, lobbyIds));

  log.info(`Cleaned up ${lobbyIds.length} old lobby(ies).`);
}
