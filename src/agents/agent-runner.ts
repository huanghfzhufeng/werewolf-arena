import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { agents as agentsTable, messages, actions, votes } from "@/db/schema";
import type { Player } from "@/db/schema";
import type { Phase } from "@/engine/state-machine";
import { isWerewolfTeam } from "@/engine/roles";
import type { Role } from "@/engine/roles";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { chatCompletion } from "./llm-client";
import { callAgentWebhook } from "./webhook-runner";
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

  // Try webhook for autonomous agents
  if (player.agentId) {
    const [agentRow] = await db
      .select({ playMode: agentsTable.playMode, webhookUrl: agentsTable.webhookUrl, apiKey: agentsTable.apiKey })
      .from(agentsTable)
      .where(eq(agentsTable.id, player.agentId));

    if (agentRow?.playMode === "autonomous" && agentRow.webhookUrl) {
      log.info(`Calling webhook for ${player.agentName}`);
      const webhookResult = await callAgentWebhook(agentRow.webhookUrl, {
        gameId, player, allPlayers, phase, round, actionType, chatHistory, knownInfo, extraContext,
        agentApiKey: agentRow.apiKey ?? undefined,
      });
      if (webhookResult) {
        return webhookResult;
      }
      log.info(`Webhook fallback to LLM for ${player.agentName}`);
    }
  }

  // Hosted mode: build prompt → call LLM → parse response
  const systemPrompt = await buildSystemPrompt({
    player,
    allPlayers,
    phase,
    round,
    actionType,
    chatHistory,
    knownInfo,
    extraContext,
  });

  const userPrompt = buildUserPrompt({
    player,
    allPlayers,
    phase,
    round,
    actionType,
    chatHistory,
    knownInfo,
    extraContext,
  });

  const response = await chatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  // Parse based on action type
  switch (actionType) {
    case "speak":
    case "speak_rebuttal":
    case "last_words":
      return { message: response };

    case "vote": {
      const voteMatch = response.match(/VOTE:\s*(.+)/i);
      const reasonMatch = response.match(/REASON:\s*(.+)/i);
      const voteName = voteMatch?.[1]?.trim() ?? response;
      const targetId = resolvePlayerTarget(voteName, allPlayers, player.id);
      return { targetId, reason: reasonMatch?.[1]?.trim() };
    }

    case "choose_kill_target": {
      const targetMatch = response.match(/TARGET:\s*(.+)/i);
      const messageMatch = response.match(/MESSAGE:\s*(.+)/i);
      const targetName = targetMatch?.[1]?.trim() ?? response;
      const nonWolves = allPlayers.filter(
        (p) => p.isAlive && p.role && !isWerewolfTeam(p.role as Role)
      );
      const targetId = resolvePlayerTarget(targetName, nonWolves);
      return { targetId, message: messageMatch?.[1]?.trim() };
    }

    case "seer_check": {
      const targetId = resolvePlayerTarget(response, allPlayers, player.id);
      return { targetId };
    }

    case "witch_decide": {
      // Parse "ACTION: save|poison|none\nTARGET: xxx" format
      const actionMatch = response.match(/ACTION:\s*(save|poison|none)/i);
      const witchTargetMatch = response.match(/TARGET:\s*(.+)/i);
      const witchAction = actionMatch?.[1]?.toLowerCase() ?? "none";
      let targetId: string | undefined;
      if (witchAction === "poison" && witchTargetMatch) {
        targetId = resolvePlayerTarget(
          witchTargetMatch[1].trim(),
          allPlayers,
          player.id
        );
      }
      return { witchAction, targetId };
    }

    case "guard_protect": {
      const targetId = resolvePlayerTarget(response, allPlayers);
      return { targetId };
    }

    case "hunter_shoot":
    case "wolf_king_revenge": {
      const targetId = resolvePlayerTarget(response, allPlayers, player.id);
      return { targetId };
    }

    case "cupid_link": {
      // Parse "LOVER1: xxx\nLOVER2: yyy" format
      const l1Match = response.match(/LOVER1:\s*(.+)/i);
      const l2Match = response.match(/LOVER2:\s*(.+)/i);
      const lover1Name = l1Match?.[1]?.trim() ?? "";
      const lover2Name = l2Match?.[1]?.trim() ?? "";
      const targetId = resolvePlayerTarget(lover1Name, allPlayers);
      const secondTargetId = resolvePlayerTarget(lover2Name, allPlayers, targetId);
      return { targetId, secondTargetId };
    }

    case "knight_speak": {
      // Parse "SPEECH: ...\nFLIP: yes|no\nTARGET: ..." format
      const speechMatch = response.match(/SPEECH:\s*(.+)/i);
      const flipMatch = response.match(/FLIP:\s*(yes|no)/i);
      const knightTargetMatch = response.match(/TARGET:\s*(.+)/i);
      const wantsFlip = flipMatch?.[1]?.toLowerCase() === "yes";

      if (wantsFlip && knightTargetMatch) {
        const targetId = resolvePlayerTarget(
          knightTargetMatch[1].trim(),
          allPlayers,
          player.id
        );
        return {
          message: speechMatch?.[1]?.trim(),
          knightCheck: true,
          targetId,
        };
      }
      return { message: speechMatch?.[1]?.trim() ?? response };
    }

    case "enchant_target": {
      const targetId = resolvePlayerTarget(response, allPlayers, player.id);
      return { targetId };
    }

    case "dreamweaver_check": {
      // Parse "PLAYER1: xxx\nPLAYER2: yyy" format
      const p1Match = response.match(/PLAYER1:\s*(.+)/i);
      const p2Match = response.match(/PLAYER2:\s*(.+)/i);
      const p1Name = p1Match?.[1]?.trim() ?? "";
      const p2Name = p2Match?.[1]?.trim() ?? "";
      const targetId = resolvePlayerTarget(p1Name, allPlayers, player.id);
      const secondTargetId = resolvePlayerTarget(p2Name, allPlayers, targetId);
      return { targetId, secondTargetId };
    }

    default:
      return {};
  }
}
