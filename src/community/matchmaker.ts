import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agents, lobbies, lobbyMembers, games, players } from "@/db/schema";
import type { Agent } from "@/db/schema";
import { getGameMode } from "@/engine/game-modes";
import { startGame } from "@/engine/state-machine";
import { emitCommunity } from "./community-events";
import { createLogger } from "@/lib";

const log = createLogger("Matchmaker");

// Simple per-lobby mutex to prevent race conditions
const lobbyLocks = new Map<string, Promise<void>>();

async function withLobbyLock<T>(lobbyId: string, fn: () => Promise<T>): Promise<T> {
  // Wait for any existing operation on this lobby to finish
  const existing = lobbyLocks.get(lobbyId);
  if (existing) await existing.catch(() => {});

  let resolve: () => void;
  const lock = new Promise<void>((r) => { resolve = r; });
  lobbyLocks.set(lobbyId, lock);

  try {
    return await fn();
  } finally {
    resolve!();
    if (lobbyLocks.get(lobbyId) === lock) {
      lobbyLocks.delete(lobbyId);
    }
  }
}

/**
 * Add an agent to a lobby for the given mode. Returns true if the lobby
 * is now full and a game should start.
 */
export async function joinLobby(
  agent: Agent,
  modeId: string
): Promise<{ joined: boolean; lobbyFull: boolean }> {
  // Find the waiting lobby for this mode
  const [lobby] = await db
    .select()
    .from(lobbies)
    .where(and(eq(lobbies.modeId, modeId), eq(lobbies.status, "waiting")));

  if (!lobby) {
    log.warn(`No waiting lobby for mode ${modeId}`);
    return { joined: false, lobbyFull: false };
  }

  return withLobbyLock(lobby.id, async () => {
    // Re-check lobby status under lock (may have started)
    const [freshLobby] = await db
      .select()
      .from(lobbies)
      .where(eq(lobbies.id, lobby.id));
    if (!freshLobby || freshLobby.status !== "waiting") {
      return { joined: false, lobbyFull: false };
    }

    // Check current member count before joining
    const currentMembers = await db
      .select()
      .from(lobbyMembers)
      .where(eq(lobbyMembers.lobbyId, lobby.id));

    if (currentMembers.length >= lobby.requiredPlayers) {
      // Already full, don't join
      return { joined: false, lobbyFull: true };
    }

    // Check if already in a lobby
    const existing = await db
      .select()
      .from(lobbyMembers)
      .where(eq(lobbyMembers.agentId, agent.id));
    if (existing.length > 0) {
      return { joined: false, lobbyFull: false };
    }

    // Join
    await db.insert(lobbyMembers).values({
      lobbyId: lobby.id,
      agentId: agent.id,
    });

    // Update agent status
    await db.update(agents).set({ status: "queued" }).where(eq(agents.id, agent.id));

    // Count current members
    const members = await db
      .select()
      .from(lobbyMembers)
      .where(eq(lobbyMembers.lobbyId, lobby.id));

    emitCommunity({
      type: "lobby_update",
      data: {
        lobbyId: lobby.id,
        modeId,
        currentPlayers: members.length,
        requiredPlayers: lobby.requiredPlayers,
        agentName: agent.name,
        action: "joined",
      },
    });

    const isFull = members.length >= lobby.requiredPlayers;
    if (isFull) {
      // Take exactly the required number of members
      const gameMembers = members.slice(0, lobby.requiredPlayers);
      await startGameFromLobby(lobby.id, modeId, gameMembers.map((m) => m.agentId));
    }

    return { joined: true, lobbyFull: isFull };
  });
}

/**
 * Create a game from a full lobby, then create a fresh lobby for the next batch.
 */
async function startGameFromLobby(
  lobbyId: string,
  modeId: string,
  agentIds: string[]
) {
  const mode = getGameMode(modeId);
  log.info(`Lobby ${lobbyId} full! Starting ${mode.nameZh}...`);

  // Mark lobby as starting
  await db.update(lobbies).set({ status: "starting" }).where(eq(lobbies.id, lobbyId));

  // Create game
  const [game] = await db.insert(games).values({ modeId }).returning();

  // Link lobby to game
  await db.update(lobbies).set({ status: "playing", gameId: game.id }).where(eq(lobbies.id, lobbyId));

  // Load agent data in a single batch query
  const agentRows = await db.select().from(agents).where(inArray(agents.id, agentIds));
  // Preserve the original order from agentIds
  const agentMap = new Map(agentRows.map((a) => [a.id, a]));
  const orderedAgents = agentIds.map((id) => agentMap.get(id)!).filter(Boolean);

  for (let i = 0; i < orderedAgents.length; i++) {
    const agent = orderedAgents[i];
    await db.insert(players).values({
      gameId: game.id,
      agentId: agent.id,
      agentName: agent.name,
      personality: agent.personality,
      seatNumber: i + 1,
    });
    // Update agent status to playing
    await db
      .update(agents)
      .set({ status: "playing", lastGameId: game.id })
      .where(eq(agents.id, agent.id));
  }

  emitCommunity({
    type: "game_auto_start",
    data: {
      gameId: game.id,
      modeId,
      modeName: mode.nameZh,
      agents: orderedAgents.map((a) => ({ id: a.id, name: a.name, avatar: a.avatar })),
    },
  });

  // Create a new waiting lobby for the next batch
  await db.insert(lobbies).values({
    modeId,
    status: "waiting",
    requiredPlayers: mode.playerCount,
  });

  // Start the game loop
  startGame(game.id).catch((err) => {
    log.error(`Failed to start game ${game.id}:`, err);
  });
}
