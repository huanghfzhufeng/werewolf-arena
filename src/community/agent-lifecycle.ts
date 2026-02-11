import { eq, and, or, gt, lt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, lobbies, lobbyMembers } from "@/db/schema";
import type { Agent } from "@/db/schema";
import { getAllGameModes } from "@/engine/game-modes";
import { joinLobby } from "./matchmaker";
import { emitCommunity } from "./community-events";
import { loadConfig } from "@/config";
import { createLogger } from "@/lib";
import { maybeRunCleanup } from "./data-cleanup";

const log = createLogger("Lifecycle");

/** Prevent concurrent tick execution */
let isTickRunning = false;

/**
 * One lifecycle tick — called every ~30 seconds by the community engine.
 */
export async function lifecycleTick(): Promise<void> {
  if (isTickRunning) return;
  isTickRunning = true;
  try {
    await processCooldowns();
    await processExpiredAgents();
    await consolidateLobbies();
    await processIdleAgents();
    await maybeRunCleanup();
  } catch (err) {
    log.error("Tick error:", err);
  } finally {
    isTickRunning = false;
  }
}

/**
 * Move cooldown agents back to idle if their cooldown has expired.
 */
async function processCooldowns(): Promise<void> {
  const now = new Date();
  const coolingDown = await db
    .select()
    .from(agents)
    .where(eq(agents.status, "cooldown"));

  for (const agent of coolingDown) {
    if (agent.cooldownUntil && agent.cooldownUntil <= now) {
      await db
        .update(agents)
        .set({ status: "idle", cooldownUntil: null })
        .where(eq(agents.id, agent.id));

      emitCommunity({
        type: "agent_status_change",
        data: { agentId: agent.id, agentName: agent.name, from: "cooldown", to: "idle" },
      });
    }
  }
}

/**
 * Mark agents whose active_until has passed as dormant.
 * Only affects non-system agents that are idle or in cooldown.
 */
async function processExpiredAgents(): Promise<void> {
  const now = new Date();
  const expired = await db
    .select()
    .from(agents)
    .where(
      and(
        or(eq(agents.status, "idle"), eq(agents.status, "cooldown")),
        eq(agents.isSystem, false),
        lt(agents.activeUntil, now)
      )
    );

  for (const agent of expired) {
    if (!agent.activeUntil || agent.activeUntil > now) continue;
    await db
      .update(agents)
      .set({ status: "dormant", cooldownUntil: null })
      .where(eq(agents.id, agent.id));

    emitCommunity({
      type: "agent_status_change",
      data: { agentId: agent.id, agentName: agent.name, from: agent.status, to: "dormant" },
    });
  }

  if (expired.length > 0) {
    log.info(`Marked ${expired.length} expired agent(s) as dormant.`);
  }
}

/**
 * Detect stalled lobbies: if queued agents are spread across multiple lobbies
 * and none can fill, move agents from the least-filled lobbies back to idle
 * so they can re-queue into the most promising lobby next tick.
 */
async function consolidateLobbies(): Promise<void> {
  const waitingLobbies = await db
    .select()
    .from(lobbies)
    .where(eq(lobbies.status, "waiting"));

  if (waitingLobbies.length === 0) return;

  // Gather member counts for each waiting lobby
  const lobbyStats: { lobbyId: string; modeId: string; required: number; memberCount: number; memberAgentIds: string[] }[] = [];
  for (const lobby of waitingLobbies) {
    const members = await db
      .select()
      .from(lobbyMembers)
      .where(eq(lobbyMembers.lobbyId, lobby.id));
    lobbyStats.push({
      lobbyId: lobby.id,
      modeId: lobby.modeId,
      required: lobby.requiredPlayers,
      memberCount: members.length,
      memberAgentIds: members.map((m) => m.agentId),
    });
  }

  // Count total queued agents across all lobbies
  const totalQueued = lobbyStats.reduce((sum, l) => sum + l.memberCount, 0);
  if (totalQueued === 0) return;

  // Find the lobby closest to filling (highest fill ratio)
  const fillable = lobbyStats
    .filter((l) => l.memberCount > 0 && totalQueued >= l.required)
    .sort((a, b) => {
      const ratioA = a.memberCount / a.required;
      const ratioB = b.memberCount / b.required;
      return ratioB - ratioA; // highest fill ratio first
    });

  if (fillable.length === 0) {
    // No lobby can be filled even with all queued agents — consolidate to smallest mode
    const smallest = lobbyStats
      .filter((l) => l.memberCount > 0)
      .sort((a, b) => a.required - b.required);
    if (smallest.length > 0 && totalQueued >= smallest[0].required) {
      fillable.push(smallest[0]);
    } else {
      return; // Not enough agents for any mode
    }
  }

  const bestLobby = fillable[0];

  // Check if the best lobby can be filled with redistribution
  const deficit = bestLobby.required - bestLobby.memberCount;
  if (deficit <= 0) return; // Already full, joinLobby should handle it

  // Find agents in OTHER lobbies that we can move
  const otherLobbies = lobbyStats.filter((l) => l.lobbyId !== bestLobby.lobbyId && l.memberCount > 0);
  const agentsToMove: string[] = [];
  for (const other of otherLobbies) {
    agentsToMove.push(...other.memberAgentIds);
  }

  if (agentsToMove.length < deficit) return; // Not enough to fill even with consolidation

  // Move agents from other lobbies back to idle (they'll re-queue next tick)
  log.info(`Consolidating: moving ${agentsToMove.length} agent(s) from ${otherLobbies.length} lobby(ies) → idle (target: ${bestLobby.modeId} ${bestLobby.memberCount}/${bestLobby.required})`);

  for (const agentId of agentsToMove) {
    // Remove from lobby_members
    await db.delete(lobbyMembers).where(
      and(eq(lobbyMembers.agentId, agentId))
    );
    // Set back to idle
    await db.update(agents).set({ status: "idle" }).where(eq(agents.id, agentId));
    emitCommunity({
      type: "agent_status_change",
      data: { agentId, agentName: "", from: "queued", to: "idle" },
    });
  }
}

/**
 * Give each idle agent a chance to decide to queue up for a game.
 * Prefers joining the lobby closest to filling over random mode selection.
 */
async function processIdleAgents(): Promise<void> {
  const now = new Date();
  const idleAgents = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.status, "idle"),
        // Active = system (no expiry) OR active_until in the future
        or(isNull(agents.activeUntil), gt(agents.activeUntil, now))
      )
    );

  if (idleAgents.length === 0) return;

  // Shuffle to avoid always processing in the same order
  const shuffled = idleAgents.sort(() => Math.random() - 0.5);

  // Find the best lobby to join: the one closest to filling
  const bestModeId = await pickBestLobbyMode();
  const modes = getAllGameModes();

  for (const agent of shuffled) {
    const shouldQueue = decideToQueue(agent);
    if (!shouldQueue) continue;

    // Prefer the lobby closest to filling; fall back to random
    const modeId = bestModeId ?? pickMode(agent, modes);
    if (!modeId) continue;

    emitCommunity({
      type: "agent_status_change",
      data: {
        agentId: agent.id,
        agentName: agent.name,
        from: "idle",
        to: "queued",
        modeId,
      },
    });

    await joinLobby(agent, modeId);
  }
}

/**
 * Find the mode whose waiting lobby is closest to filling.
 * Returns null if all lobbies are empty.
 */
async function pickBestLobbyMode(): Promise<string | null> {
  const waitingLobbies = await db
    .select()
    .from(lobbies)
    .where(eq(lobbies.status, "waiting"));

  let bestMode: string | null = null;
  let bestRatio = 0;

  for (const lobby of waitingLobbies) {
    const members = await db
      .select()
      .from(lobbyMembers)
      .where(eq(lobbyMembers.lobbyId, lobby.id));
    const ratio = members.length / lobby.requiredPlayers;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestMode = lobby.modeId;
    }
  }

  // Only direct agents to the best lobby if it has meaningful progress (>25% full)
  return bestRatio >= 0.25 ? bestMode : null;
}

/**
 * Probability-based decision: should this agent queue?
 * Higher probability for agents who have been idle longer.
 * @internal Exported for testing
 */
export function decideToQueue(agent: Agent): boolean {
  const c = loadConfig().community;
  const eagerBonus =
    agent.totalGames < c.eagerBonusThreshold ? c.eagerBonusChance : 0;

  const roll = Math.random();
  return roll < c.baseQueueChance + eagerBonus;
}

/**
 * Pick a game mode for the agent based on simple heuristics.
 * Most agents prefer classic-6p (fast), some prefer larger modes.
 * @internal Exported for testing
 */
export function pickMode(
  agent: Agent,
  modes: ReturnType<typeof getAllGameModes>
): string | null {
  if (modes.length === 0) return null;

  const c = loadConfig().community;
  const weights: Record<string, number> =
    agent.totalGames > c.experiencedGameThreshold
      ? { ...c.experiencedModeWeights }
      : { ...c.defaultModeWeights };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;

  for (const mode of modes) {
    const w = weights[mode.id] ?? 10;
    roll -= w;
    if (roll <= 0) return mode.id;
  }

  return modes[0].id;
}

/**
 * Called when a game ends to put agents into cooldown + update ELO.
 */
export async function updateAgentPostGame(
  agentId: string,
  gameId: string,
  won: boolean,
  opponentAvgElo: number
): Promise<void> {
  const c = loadConfig().community;
  const cooldownMs = c.cooldownMinMs + Math.random() * (c.cooldownMaxMs - c.cooldownMinMs);
  const cooldownUntil = new Date(Date.now() + cooldownMs);

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) return;

  const newTotalGames = agent.totalGames + 1;
  const newTotalWins = agent.totalWins + (won ? 1 : 0);
  const newWinRate = newTotalGames > 0 ? newTotalWins / newTotalGames : 0;

  // ELO calculation (K=32)
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (opponentAvgElo - agent.elo) / 400));
  const actual = won ? 1 : 0;
  const newElo = Math.round(agent.elo + K * (actual - expected));

  await db
    .update(agents)
    .set({
      status: "cooldown",
      cooldownUntil,
      totalGames: newTotalGames,
      totalWins: newTotalWins,
      winRate: newWinRate,
      elo: newElo,
      lastGameId: gameId,
    })
    .where(eq(agents.id, agentId));

  emitCommunity({
    type: "agent_status_change",
    data: {
      agentId: agent.id,
      agentName: agent.name,
      from: "playing",
      to: "cooldown",
      cooldownUntil: cooldownUntil.toISOString(),
      won,
      elo: newElo,
    },
  });
}
