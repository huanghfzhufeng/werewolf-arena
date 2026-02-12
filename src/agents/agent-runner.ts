import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { agents as agentsTable, messages, actions, votes } from "@/db/schema";
import type { Player, Message } from "@/db/schema";
import type { Phase } from "@/engine/state-machine";
import { isWerewolfTeam } from "@/engine/roles";
import type { Role } from "@/engine/roles";
import { callAgentWebhook } from "./webhook-runner";
import { createPendingTurn } from "./pending-turns";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { chatCompletion } from "./llm-client";
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

function cleanLLMOutput(raw: string): string {
  return raw
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
}

function extractTaggedValue(text: string, tag: string): string | undefined {
  const re = new RegExp(`${tag}\\s*[:：]\\s*([^\\n]+)`, "i");
  const match = text.match(re);
  if (!match?.[1]) return undefined;
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function extractMentionedTargetIds(
  text: string,
  allPlayers: Player[],
  excludeIds: string[] = []
): string[] {
  const ids: string[] = [];
  const excluded = new Set(excludeIds);
  for (const p of allPlayers) {
    if (!p.isAlive || excluded.has(p.id)) continue;
    if (text.includes(p.agentName)) {
      ids.push(p.id);
      excluded.add(p.id);
    }
  }
  return ids;
}

/** @internal Exported for testing */
export function parseLLMTurnResponse(
  raw: string,
  actionType: string,
  allPlayers: Player[],
  player: Player
): AgentTurnResult | null {
  const text = cleanLLMOutput(raw);
  if (!text) return null;

  const resolveTarget = (
    candidate: string | undefined,
    excludeId: string = player.id
  ): string | undefined => {
    if (candidate) {
      const found = resolvePlayerTarget(candidate, allPlayers, excludeId);
      if (found) return found;
    }
    const mentioned = extractMentionedTargetIds(text, allPlayers, [excludeId]);
    return mentioned[0];
  };

  switch (actionType) {
    case "speak":
    case "speak_rebuttal":
    case "last_words": {
      const message = extractTaggedValue(text, "MESSAGE") ?? text;
      return message ? { message: message.slice(0, 500) } : null;
    }

    case "vote":
    case "seer_check":
    case "guard_protect":
    case "hunter_shoot":
    case "wolf_king_revenge":
    case "enchant_target": {
      const targetText = extractTaggedValue(text, "TARGET") ?? text;
      const targetId = resolveTarget(targetText);
      return targetId ? { targetId } : null;
    }

    case "choose_kill_target": {
      const targetText = extractTaggedValue(text, "TARGET") ?? text;
      const targetId = resolveTarget(targetText);
      if (!targetId) return null;
      const message = extractTaggedValue(text, "MESSAGE");
      return { targetId, message: message?.slice(0, 500) };
    }

    case "witch_decide": {
      const taggedAction =
        extractTaggedValue(text, "WITCH_ACTION") ?? extractTaggedValue(text, "ACTION");
      const actionText = (taggedAction ?? text).toLowerCase();

      let witchAction: "save" | "poison" | "none" | null = null;
      if (/^(save|poison|none)$/i.test(actionText.trim())) {
        witchAction = actionText.trim() as "save" | "poison" | "none";
      } else if (/(none|skip|不使用|不行动|不救也不毒|放弃)/i.test(actionText)) {
        witchAction = "none";
      } else if (/(poison|下毒|毒药|毒)/i.test(actionText)) {
        witchAction = "poison";
      } else if (/(save|解药|救人|救)/i.test(actionText)) {
        witchAction = "save";
      }
      if (!witchAction) return null;

      if (witchAction === "poison") {
        const targetText = extractTaggedValue(text, "TARGET") ?? text;
        const targetId = resolveTarget(targetText);
        return targetId ? { witchAction: "poison", targetId } : null;
      }
      return { witchAction };
    }

    case "cupid_link":
    case "dreamweaver_check": {
      const shouldExcludeSelf = true;
      const excludeIds = shouldExcludeSelf ? [player.id] : [];
      const picked: string[] = [];

      const target1Raw = extractTaggedValue(text, "TARGET");
      const target1 = target1Raw
        ? resolvePlayerTarget(
            target1Raw,
            allPlayers,
            shouldExcludeSelf ? player.id : undefined
          )
        : undefined;
      if (target1) picked.push(target1);

      const target2Raw =
        extractTaggedValue(text, "SECOND_TARGET") ??
        extractTaggedValue(text, "TARGET2");
      if (target2Raw) {
        const target2 = resolvePlayerTarget(
          target2Raw,
          allPlayers,
          picked[0] ?? (shouldExcludeSelf ? player.id : undefined)
        );
        if (target2 && !picked.includes(target2)) picked.push(target2);
      }

      if (picked.length < 2) {
        const mentions = extractMentionedTargetIds(text, allPlayers, [
          ...excludeIds,
          ...picked,
        ]);
        for (const id of mentions) {
          if (!picked.includes(id)) picked.push(id);
          if (picked.length >= 2) break;
        }
      }

      return picked.length >= 2
        ? { targetId: picked[0], secondTargetId: picked[1] }
        : null;
    }

    case "knight_speak": {
      const flipTag = (extractTaggedValue(text, "FLIP") ?? "").toLowerCase();
      const wantsFlip = flipTag
        ? /^(true|yes|1|是|翻牌|翻验|flip)$/i.test(flipTag)
        : /(flip|翻牌|翻验|亮出身份)/i.test(text);

      if (wantsFlip) {
        const targetText = extractTaggedValue(text, "TARGET") ?? text;
        const targetId = resolveTarget(targetText);
        if (targetId) {
          const message = extractTaggedValue(text, "MESSAGE");
          return {
            knightCheck: true,
            targetId,
            message: message?.slice(0, 500),
          };
        }
      }

      const message = extractTaggedValue(text, "MESSAGE") ?? text;
      return message ? { message: message.slice(0, 500) } : null;
    }

    default:
      return null;
  }
}

async function runHostedLLM(
  params: AgentTurnParams,
  knownInfo: string[],
  chatHistory: Message[]
): Promise<AgentTurnResult | null> {
  try {
    const systemPrompt = await buildSystemPrompt({
      player: params.player,
      allPlayers: params.allPlayers,
      phase: params.phase,
      round: params.round,
      actionType: params.actionType,
      chatHistory,
      knownInfo,
      extraContext: params.extraContext,
    });
    const userPrompt = buildUserPrompt({
      player: params.player,
      allPlayers: params.allPlayers,
      phase: params.phase,
      round: params.round,
      actionType: params.actionType,
      chatHistory,
      knownInfo,
      extraContext: params.extraContext,
    });

    const raw = await chatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.6 }
    );

    const parsed = parseLLMTurnResponse(
      raw,
      params.actionType,
      params.allPlayers,
      params.player
    );
    if (!parsed) {
      log.warn(
        `Failed to parse hosted LLM output for ${params.player.agentName} (${params.actionType})`
      );
      return null;
    }
    return parsed;
  } catch (err) {
    log.warn(
      `Hosted LLM failed for ${params.player.agentName} (${params.actionType})`,
      err
    );
    return null;
  }
}

/**
 * Run a single agent's turn.
 * For autonomous agents, order is: webhook -> polling -> hosted-LLM fallback.
 * For hosted agents, go straight to hosted-LLM.
 * If hosted-LLM fails, use random fallback.
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
      log.info(`Polling timed out for ${player.agentName}, trying hosted LLM fallback`);
    }
  }

  // Hosted path: use role + memory aware LLM decision.
  const hostedResult = await runHostedLLM(params, knownInfo, chatHistory);
  if (hostedResult) {
    return hostedResult;
  }

  // Last resort fallback: random valid action.
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
