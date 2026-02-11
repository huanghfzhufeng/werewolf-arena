import { createLogger } from "@/lib";

const log = createLogger("SkillEvents");

// ─── Types ──────────────────────────────────────────────────────

export type GameEventType =
  | "werewolf_kill"
  | "witch_save"
  | "witch_poison"
  | "guard_protect"
  | "seer_check"
  | "hunter_shoot"
  | "cupid_link"
  | "wolf_king_revenge"
  | "white_wolf_explode"
  | "knight_check"
  | "idiot_reveal"
  | "enchant_action"
  | "dreamweaver_check";

export type GameEvent = {
  type: GameEventType;
  gameId: string;
  round: number;
  data: Record<string, unknown>;
};

export type GameHookHandler = (event: GameEvent) => Promise<void> | void;

// ─── Per-game event store ───────────────────────────────────────

/**
 * Stores events emitted during a game round.
 * Key: `${gameId}:${round}`, Value: list of events.
 * Used by the context resolver to collect data for skill `requires.context`.
 */
const roundEvents = new Map<string, GameEvent[]>();

function roundKey(gameId: string, round: number): string {
  return `${gameId}:${round}`;
}

export function getRoundEvents(gameId: string, round: number): GameEvent[] {
  return roundEvents.get(roundKey(gameId, round)) ?? [];
}

export function clearRoundEvents(gameId: string, round: number): void {
  roundEvents.delete(roundKey(gameId, round));
}

/** Clean up all events for a game (call at game end). */
export function clearGameEvents(gameId: string): void {
  for (const key of roundEvents.keys()) {
    if (key.startsWith(`${gameId}:`)) {
      roundEvents.delete(key);
    }
  }
}

// ─── Hook registry ──────────────────────────────────────────────

const hooks = new Map<GameEventType, Set<GameHookHandler>>();

export function registerGameHook(
  eventType: GameEventType,
  handler: GameHookHandler
): void {
  if (!hooks.has(eventType)) {
    hooks.set(eventType, new Set());
  }
  hooks.get(eventType)!.add(handler);
}

export function removeGameHook(
  eventType: GameEventType,
  handler: GameHookHandler
): void {
  hooks.get(eventType)?.delete(handler);
}

export function clearGameHooks(): void {
  hooks.clear();
}

// ─── Trigger ────────────────────────────────────────────────────

/**
 * Emit a game event:
 * 1. Store it in the round event log (for context resolver).
 * 2. Call all registered hook handlers.
 */
export async function triggerGameHook(event: GameEvent): Promise<void> {
  // Store event
  const key = roundKey(event.gameId, event.round);
  if (!roundEvents.has(key)) {
    roundEvents.set(key, []);
  }
  roundEvents.get(key)!.push(event);

  log.debug(`Event: ${event.type} (game=${event.gameId}, round=${event.round})`);

  // Notify handlers
  const handlers = hooks.get(event.type);
  if (!handlers || handlers.size === 0) return;

  for (const handler of handlers) {
    try {
      await handler(event);
    } catch (err) {
      log.error(`Hook handler error for ${event.type}:`, err);
    }
  }
}
