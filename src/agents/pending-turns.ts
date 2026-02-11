/**
 * In-memory pending turn queue for the polling-based agent interaction model.
 *
 * The game loop (state-machine.ts) calls runAgentTurn(), which:
 *   1. Creates a pending turn entry with the game state
 *   2. Waits for the agent to respond (via polling API) or timeout
 *
 * The polling API:
 *   GET  /api/v1/games/my-turn  → reads the pending turn for the authenticated agent
 *   POST /api/v1/games/respond  → resolves the pending turn with the agent's decision
 */

import type { AgentTurnResult } from "./agent-runner";
import type { Player, Message } from "@/db/schema";
import type { Phase } from "@/engine/state-machine";
import { createLogger } from "@/lib";

const log = createLogger("PendingTurns");

export type PendingTurnState = {
    gameId: string;
    round: number;
    phase: Phase;
    actionType: string;
    /** The player whose turn it is */
    player: Player;
    /** All players in the game (for alive/dead lists) */
    allPlayers: Player[];
    /** Chat history for this phase */
    chatHistory: Message[];
    /** Known info (seer results, past votes, etc.) */
    knownInfo: string[];
    /** Extra context (witch potions, guard last target, etc.) */
    extraContext?: Record<string, unknown>;
    /** Timestamp when this turn was created */
    createdAt: number;
};

type PendingTurn = {
    state: PendingTurnState;
    resolve: (result: AgentTurnResult) => void;
    timeoutId: ReturnType<typeof setTimeout>;
};

/**
 * Map of agentId → pending turn.
 * Only one turn can be pending per agent at a time.
 */
const pendingTurns = new Map<string, PendingTurn>();

/** Default timeout: 60 seconds for agent to respond via polling */
const POLL_TIMEOUT_MS = 60_000;

/**
 * Create a pending turn and return a promise that resolves when the agent
 * responds (via the polling API) or the timeout expires.
 */
export function createPendingTurn(
    agentId: string,
    state: PendingTurnState,
    timeoutMs: number = POLL_TIMEOUT_MS
): Promise<AgentTurnResult | null> {
    // Clean up any existing pending turn for this agent
    clearPendingTurn(agentId);

    return new Promise<AgentTurnResult | null>((resolve) => {
        const timeoutId = setTimeout(() => {
            log.warn(`Pending turn timed out for agent ${agentId} (action: ${state.actionType})`);
            pendingTurns.delete(agentId);
            resolve(null);
        }, timeoutMs);

        pendingTurns.set(agentId, {
            state,
            resolve: (result: AgentTurnResult) => {
                clearTimeout(timeoutId);
                pendingTurns.delete(agentId);
                resolve(result);
            },
            timeoutId,
        });

        log.info(`Created pending turn for agent ${agentId}: ${state.actionType}`);
    });
}

/**
 * Get the pending turn state for an agent (used by the polling API).
 * Returns null if no turn is pending.
 */
export function getPendingTurn(agentId: string): PendingTurnState | null {
    const pending = pendingTurns.get(agentId);
    return pending?.state ?? null;
}

/**
 * Resolve a pending turn with the agent's decision (used by the respond API).
 * Returns true if the turn was found and resolved.
 */
export function resolvePendingTurn(agentId: string, result: AgentTurnResult): boolean {
    const pending = pendingTurns.get(agentId);
    if (!pending) {
        log.warn(`No pending turn found for agent ${agentId}`);
        return false;
    }
    pending.resolve(result);
    return true;
}

/**
 * Clear a pending turn without resolving it.
 */
function clearPendingTurn(agentId: string): void {
    const pending = pendingTurns.get(agentId);
    if (pending) {
        clearTimeout(pending.timeoutId);
        pendingTurns.delete(agentId);
    }
}

/**
 * Check if an agent has a pending turn.
 */
export function hasPendingTurn(agentId: string): boolean {
    return pendingTurns.has(agentId);
}
