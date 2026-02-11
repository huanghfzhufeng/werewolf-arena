import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents as agentsTable } from "@/db/schema";
import type { Player, Message } from "@/db/schema";
import type { Phase } from "@/engine/state-machine";
import type { AgentTurnResult } from "./agent-runner";
import { isWerewolfTeam } from "@/engine/roles";
import type { Role } from "@/engine/roles";
import { createLogger } from "@/lib";

const log = createLogger("WebhookRunner");

const WEBHOOK_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_MESSAGE_LENGTH = 500;
const MAX_TARGET_LENGTH = 50;
const MAX_CONSECUTIVE_FAILURES = 3;

// ─── Failure Tracking (in-memory, resets on process restart) ─────
const webhookFailures = new Map<string, number>();

function recordFailure(agentId: string): number {
  const count = (webhookFailures.get(agentId) ?? 0) + 1;
  webhookFailures.set(agentId, count);
  return count;
}

function recordSuccess(agentId: string): void {
  webhookFailures.delete(agentId);
}

/** Reset failure count (called from heartbeat) */
export function resetWebhookFailures(agentId: string): void {
  webhookFailures.delete(agentId);
}

// ─── Message Sanitization ───────────────────────────────────────

const FAKE_SYSTEM_PATTERNS = [
  /【系统】/g,
  /\[SYSTEM\]/gi,
  /\[系统\]/g,
  /【管理员】/g,
  /\[ADMIN\]/gi,
  /【法官】/g,
  /\[JUDGE\]/gi,
];

const CODE_BLOCK_RE = /```[\s\S]*?```/g;
const URL_RE = /https?:\/\/\S+/gi;

/** @internal Exported for testing */
export function sanitizeMessage(raw: string): string {
  let msg = raw.slice(0, MAX_MESSAGE_LENGTH);
  // Strip fake system message markers
  for (const pattern of FAKE_SYSTEM_PATTERNS) {
    msg = msg.replace(pattern, "");
  }
  // Strip code blocks (potential prompt injection)
  msg = msg.replace(CODE_BLOCK_RE, "");
  // Strip URLs (prevent phishing in chat)
  msg = msg.replace(URL_RE, "");
  return msg.trim();
}

/** @internal Exported for testing */
export function sanitizeTarget(raw: string): string {
  return raw.trim().slice(0, MAX_TARGET_LENGTH);
}

// ─── Response Schema Validation ─────────────────────────────────

/** @internal Exported for testing */
export function validateResponse(
  data: Record<string, unknown>,
  actionType: string
): { valid: true } | { valid: false; reason: string } {
  switch (actionType) {
    case "speak":
    case "speak_rebuttal":
      if (typeof data.message !== "string" || data.message.trim().length === 0) {
        return { valid: false, reason: "Missing or empty 'message' field" };
      }
      return { valid: true };

    case "vote":
    case "seer_check":
    case "guard_protect":
    case "hunter_shoot":
    case "wolf_king_revenge":
    case "choose_kill_target":
      if (typeof data.target !== "string" || data.target.trim().length === 0) {
        return { valid: false, reason: "Missing or empty 'target' field" };
      }
      return { valid: true };

    case "witch_decide": {
      const action = data.witch_action;
      if (action !== "save" && action !== "poison" && action !== "none") {
        return { valid: false, reason: "witch_action must be 'save', 'poison', or 'none'" };
      }
      if (action === "poison" && (typeof data.target !== "string" || data.target.trim().length === 0)) {
        return { valid: false, reason: "'target' is required when witch_action is 'poison'" };
      }
      return { valid: true };
    }

    case "cupid_link":
      if (typeof data.target !== "string" || data.target.trim().length === 0) {
        return { valid: false, reason: "Missing 'target' for cupid_link" };
      }
      if (typeof data.second_target !== "string" || data.second_target.trim().length === 0) {
        return { valid: false, reason: "Missing 'second_target' for cupid_link" };
      }
      return { valid: true };

    default:
      return { valid: true };
  }
}

// ─── HMAC Signing ───────────────────────────────────────────────

function signPayload(apiKey: string, body: string): string {
  return createHmac("sha256", apiKey).update(body).digest("hex");
}

// ─── Types ──────────────────────────────────────────────────────

type WebhookPayload = {
  game_id: string;
  round: number;
  phase: Phase;
  action_type: string;
  your_role: string;
  your_seat: number;
  alive_players: { name: string; seat: number }[];
  dead_players: { name: string; seat: number }[];
  chat_history: { speaker: string; content: string }[];
  known_info: string[];
  extra_context: Record<string, unknown>;
};

// ─── Main Entry Point ───────────────────────────────────────────

/**
 * Call an agent's webhook URL with game state, return their decision.
 * Returns null if the webhook fails or times out (caller should fallback to LLM).
 *
 * Features:
 * - HMAC-SHA256 request signing (X-Werewolf-Signature header)
 * - Response schema validation per action_type
 * - Message content sanitization
 * - Failure tracking with auto-downgrade after 3 consecutive failures
 */
export async function callAgentWebhook(
  webhookUrl: string,
  params: {
    gameId: string;
    player: Player;
    allPlayers: Player[];
    phase: Phase;
    round: number;
    actionType: string;
    chatHistory: Message[];
    knownInfo: string[];
    extraContext?: Record<string, unknown>;
    agentApiKey?: string;
  }
): Promise<AgentTurnResult | null> {
  const { gameId, player, allPlayers, phase, round, actionType, chatHistory, knownInfo, extraContext, agentApiKey } = params;

  const alivePlayers = allPlayers.filter((p) => p.isAlive).map((p) => ({
    name: p.agentName,
    seat: p.seatNumber,
  }));
  const deadPlayers = allPlayers.filter((p) => !p.isAlive).map((p) => ({
    name: p.agentName,
    seat: p.seatNumber,
  }));

  const history = chatHistory.map((m) => ({
    speaker: m.isSystem
      ? "【系统】"
      : allPlayers.find((p) => p.id === m.playerId)?.agentName ?? "未知",
    content: m.content,
  }));

  const role = (player.role ?? "villager") as Role;
  const payload: WebhookPayload = {
    game_id: gameId,
    round,
    phase,
    action_type: actionType,
    your_role: role,
    your_seat: player.seatNumber,
    alive_players: alivePlayers,
    dead_players: deadPlayers,
    chat_history: history,
    known_info: knownInfo,
    extra_context: extraContext ?? {},
  };

  // If werewolf, include teammate info
  if (isWerewolfTeam(role) && role !== "madman") {
    const teammates = allPlayers
      .filter((p) => p.id !== player.id && p.role && isWerewolfTeam(p.role as Role) && p.role !== "madman")
      .map((p) => ({ name: p.agentName, seat: p.seatNumber, role: p.role, alive: p.isAlive }));
    payload.extra_context.teammates = teammates;
  }

  const bodyJson = JSON.stringify(payload);

  // Build headers with HMAC signature
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (agentApiKey) {
    headers["X-Werewolf-Signature"] = `sha256=${signPayload(agentApiKey, bodyJson)}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: bodyJson,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      log.warn(`Webhook returned ${response.status} for ${player.agentName}`);
      await handleFailure(player);
      return null;
    }

    const data = await response.json();

    // Validate response schema
    const validation = validateResponse(data, actionType);
    if (!validation.valid) {
      log.warn(`Webhook response validation failed for ${player.agentName}: ${validation.reason}`);
      await handleFailure(player);
      return null;
    }

    // Parse and sanitize
    const result = parseWebhookResponse(data, allPlayers, player.id);
    if (player.agentId) recordSuccess(player.agentId);
    return result;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      log.warn(`Webhook timeout for ${player.agentName} (${WEBHOOK_TIMEOUT_MS}ms)`);
    } else {
      log.warn(`Webhook error for ${player.agentName}:`, err);
    }
    await handleFailure(player);
    return null;
  }
}

/**
 * Track failure and clear webhook URL after MAX_CONSECUTIVE_FAILURES.
 * The agent can still respond via polling; the webhook is just disabled.
 */
async function handleFailure(player: Player): Promise<void> {
  if (!player.agentId) return;
  const count = recordFailure(player.agentId);
  if (count >= MAX_CONSECUTIVE_FAILURES) {
    log.warn(
      `Agent ${player.agentName} hit ${count} consecutive webhook failures — clearing webhook URL`
    );
    await db
      .update(agentsTable)
      .set({ webhookUrl: null })
      .where(eq(agentsTable.id, player.agentId));
    webhookFailures.delete(player.agentId);
  }
}

/**
 * Parse the webhook response into an AgentTurnResult.
 * Applies sanitization to all string fields.
 */
function parseWebhookResponse(
  data: Record<string, unknown>,
  allPlayers: Player[],
  excludeId: string
): AgentTurnResult {
  const result: AgentTurnResult = {};

  if (typeof data.message === "string") {
    result.message = sanitizeMessage(data.message);
  }

  // Resolve target name to player ID
  if (typeof data.target === "string") {
    const targetName = sanitizeTarget(data.target);
    const target = allPlayers.find(
      (p) => p.isAlive && p.id !== excludeId && p.agentName === targetName
    );
    result.targetId = target?.id;
  }

  // Second target (for cupid)
  if (typeof data.second_target === "string") {
    const targetName = sanitizeTarget(data.second_target);
    const target = allPlayers.find(
      (p) => p.isAlive && p.agentName === targetName
    );
    result.secondTargetId = target?.id;
  }

  // Witch action
  if (typeof data.witch_action === "string") {
    const action = data.witch_action.trim().toLowerCase();
    if (action === "save" || action === "poison" || action === "none") {
      result.witchAction = action;
    }
  }

  return result;
}
