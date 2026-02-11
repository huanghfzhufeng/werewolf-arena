import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { agents as agentsTable, messages, actions, votes } from "@/db/schema";
import type { Player } from "@/db/schema";
import type { Phase } from "@/engine/state-machine";
import { isWerewolfTeam } from "@/engine/roles";
import type { Role } from "@/engine/roles";
import { callAgentWebhook } from "./webhook-runner";
import { createPendingTurn } from "./pending-turns";
import { createLogger } from "@/lib";

const log = createLogger("AgentRunner");

export type AgentTurnParams = {
  gameId: string;
  player: Player;
  allPlayers: Player[];
  phase: Phase;
  round: number;
  actionType: string;
  /** Extra context for specific phases (witch potions, guard last target, etc.) */
  extraContext?: Record<string, unknown>;
};

export type AgentTurnResult = {
  message?: string;
  targetId?: string;
  /** Second target for cupid_link / dreamweaver_check */
  secondTargetId?: string;
  reason?: string;
  /** Witch-specific: "save" | "poison" | "none" */
  witchAction?: string;
  /** Knight-specific: true if knight chose to flip a card this turn */
  knightCheck?: boolean;
};

/**
 * Gather known information for a player based on their role and past actions.
 */
async function gatherKnownInfo(
  gameId: string,
  player: Player,
  allPlayers: Player[],
  currentRound: number
): Promise<string[]> {
  const info: string[] = [];

  // Seer knows results of past checks
  if (player.role === "seer") {
    const seerActions = await db
      .select()
      .from(actions)
      .where(
        and(
          eq(actions.gameId, gameId),
          eq(actions.playerId, player.id),
          eq(actions.actionType, "seer_check")
        )
      );
    for (const action of seerActions) {
      const target = allPlayers.find((p) => p.id === action.targetId);
      if (target) {
        info.push(
          `Round ${action.round}: You checked ${target.agentName} → ${action.result}`
        );
      }
    }
  }

  // All players know past vote results
  if (currentRound > 1) {
    const pastVotes = await db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.gameId, gameId),
          eq(votes.phase, "day_vote")
        )
      );

    // Group by round
    const votesByRound = new Map<number, { voter: string; target: string }[]>();
    for (const v of pastVotes) {
      if (v.round >= currentRound) continue; // only past rounds
      if (!votesByRound.has(v.round)) votesByRound.set(v.round, []);
      const voterName = allPlayers.find((p) => p.id === v.voterId)?.agentName ?? "?";
      const targetName = allPlayers.find((p) => p.id === v.targetId)?.agentName ?? "?";
      votesByRound.get(v.round)!.push({ voter: voterName, target: targetName });
    }

    for (const [r, rv] of [...votesByRound].sort((a, b) => a[0] - b[0])) {
      const summary = rv.map((v) => `${v.voter}→${v.target}`).join(", ");
      info.push(`Round ${r} votes: ${summary}`);
    }
  }

  return info;
}

/**
 * Get chat history relevant to the current phase.
 * Includes previous rounds for context (summarized older rounds).
 */
async function getChatHistory(
  gameId: string,
  round: number,
  phase: Phase
) {
  // For night werewolf phase, only get current round's wolf messages
  if (phase === "night_werewolf") {
    return db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.gameId, gameId),
          eq(messages.round, round),
          eq(messages.phase, "night_werewolf")
        )
      )
      .orderBy(asc(messages.createdAt));
  }

  // For day phases, include all public messages from all rounds
  // so agents remember what happened before
  const allMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.gameId, gameId))
    .orderBy(asc(messages.createdAt));

  // Filter: exclude private messages (wolf chat) and night-phase messages
  return allMessages.filter(
    (m) => !m.isPrivate && m.phase !== "night_werewolf" && m.phase !== "night_seer"
  );
}

/** @internal Exported for testing */
export function resolvePlayerTarget(
  text: string,
  allPlayers: Player[],
  excludeId?: string
): string | undefined {
  const aliveCandidates = allPlayers.filter(
    (p) => p.isAlive && p.id !== excludeId
  );

  // Direct name match
  for (const p of aliveCandidates) {
    if (text.includes(p.agentName)) {
      return p.id;
    }
  }

  // Fuzzy: try matching substrings (only match if name is 2+ chars to avoid false positives)
  const cleaned = text.trim().replace(/["""'']/g, "");
  for (const p of aliveCandidates) {
    if (cleaned.includes(p.agentName)) {
      return p.id;
    }
  }
  // Reverse match only for longer names (3+ chars) to avoid false positives
  if (cleaned.length >= 3) {
    for (const p of aliveCandidates) {
      if (p.agentName.includes(cleaned)) {
        return p.id;
      }
    }
  }

  // No match — return undefined, let caller handle the miss
  log.warn(`Could not resolve player target from: "${text.slice(0, 50)}"`);
  return undefined;
}

/**
 * Run a single agent's turn.
 * For autonomous agents with a webhook, try webhook first; fallback to LLM.
 * For hosted agents, go straight to LLM.
 */
export async function runAgentTurn(
  params: AgentTurnParams
): Promise<AgentTurnResult> {
  const { gameId, player, allPlayers, phase, round, actionType, extraContext } = params;

  const knownInfo = await gatherKnownInfo(gameId, player, allPlayers, round);
  const chatHistory = await getChatHistory(gameId, round, phase);

  // Try webhook for autonomous agents with a webhook URL
  if (player.agentId) {
    const [agentRow] = await db
      .select({ playMode: agentsTable.playMode, webhookUrl: agentsTable.webhookUrl, apiKey: agentsTable.apiKey })
      .from(agentsTable)
      .where(eq(agentsTable.id, player.agentId));

    if (agentRow?.playMode === "autonomous") {
      // Path 1: Webhook (if configured)
      if (agentRow.webhookUrl) {
        log.info(`Calling webhook for ${player.agentName}`);
        const webhookResult = await callAgentWebhook(agentRow.webhookUrl, {
          gameId, player, allPlayers, phase, round, actionType, chatHistory, knownInfo, extraContext,
          agentApiKey: agentRow.apiKey ?? undefined,
        });
        if (webhookResult) {
          return webhookResult;
        }
        log.info(`Webhook failed for ${player.agentName}, trying polling fallback`);
      }

      // Path 2: Polling (agent uses GET /api/v1/games/my-turn + POST /api/v1/games/respond)
      log.info(`Creating pending turn for ${player.agentName} (polling mode)`);
      const pollResult = await createPendingTurn(player.agentId, {
        gameId, round, phase, actionType, player, allPlayers, chatHistory, knownInfo, extraContext,
        createdAt: Date.now(),
      });
      if (pollResult) {
        return pollResult;
      }
      log.info(`Polling timed out for ${player.agentName}, using random fallback`);
    }
  }

  // Fallback: random action (no more server-side LLM decisions)
  log.info(`Using random fallback for ${player.agentName} (action: ${actionType})`);
  return randomFallback(actionType, allPlayers, player);
}

/**
 * Generate a random but valid action as a fallback.
 * Used when an agent fails to respond via webhook or polling.
 */
function randomFallback(
  actionType: string,
  allPlayers: Player[],
  player: Player
): AgentTurnResult {
  const aliveCandidates = allPlayers.filter(
    (p) => p.isAlive && p.id !== player.id
  );
  const randomTarget = () =>
    aliveCandidates.length > 0
      ? aliveCandidates[Math.floor(Math.random() * aliveCandidates.length)].id
      : undefined;

  switch (actionType) {
    case "speak":
    case "speak_rebuttal":
    case "last_words":
      return { message: "……" };

    case "vote":
    case "seer_check":
    case "guard_protect":
    case "hunter_shoot":
    case "wolf_king_revenge":
    case "enchant_target":
      return { targetId: randomTarget() };

    case "choose_kill_target": {
      const nonWolves = allPlayers.filter(
        (p) => p.isAlive && p.role && !isWerewolfTeam(p.role as Role)
      );
      const target = nonWolves.length > 0
        ? nonWolves[Math.floor(Math.random() * nonWolves.length)].id
        : randomTarget();
      return { targetId: target };
    }

    case "witch_decide":
      return { witchAction: "none" };

    case "cupid_link": {
      if (aliveCandidates.length >= 2) {
        const shuffled = [...aliveCandidates].sort(() => Math.random() - 0.5);
        return { targetId: shuffled[0].id, secondTargetId: shuffled[1].id };
      }
      return { targetId: randomTarget() };
    }

    case "knight_speak":
      return { message: "……" };

    case "dreamweaver_check": {
      if (aliveCandidates.length >= 2) {
        const shuffled = [...aliveCandidates].sort(() => Math.random() - 0.5);
        return { targetId: shuffled[0].id, secondTargetId: shuffled[1].id };
      }
      return {};
    }

    default:
      return {};
  }
}

