import { initCommunity } from "./init";
import { recoverZombieGames } from "./recovery";
import { lifecycleTick } from "./agent-lifecycle";
import { loadConfig } from "@/config";
import { createLogger } from "@/lib";

const log = createLogger("CommunityEngine");

type EngineState = {
  running: boolean;
  intervalId: ReturnType<typeof setInterval> | null;
  initialized: boolean;
};

// Use globalThis to survive Next.js hot-reloads in dev mode
const globalKey = "__werewolf_community_engine__" as const;

function getState(): EngineState {
  if (!(globalThis as Record<string, unknown>)[globalKey]) {
    (globalThis as Record<string, unknown>)[globalKey] = {
      running: false,
      intervalId: null,
      initialized: false,
    };
  }
  return (globalThis as Record<string, unknown>)[globalKey] as EngineState;
}

/**
 * Start the community engine. Initializes agents if needed,
 * then begins the lifecycle tick loop.
 */
export async function startCommunityEngine(): Promise<void> {
  const state = getState();
  if (state.running) {
    log.info("Already running.");
    return;
  }

  log.info("Starting...");

  // Initialize community (seed agents + lobbies) if needed
  if (!state.initialized) {
    await initCommunity();
    await recoverZombieGames();
    state.initialized = true;
  }

  // Start the tick loop
  const tickMs = loadConfig().community.tickIntervalMs;
  state.intervalId = setInterval(async () => {
    try {
      await lifecycleTick();
    } catch (err) {
      log.error("Tick error:", err);
    }
  }, tickMs);

  state.running = true;
  log.info(`Running. Tick every ${tickMs / 1000}s.`);

  // Run the first tick immediately
  lifecycleTick().catch((e) => log.error("First tick error:", e));
}

/**
 * Stop the community engine.
 */
export function stopCommunityEngine(): void {
  const state = getState();
  if (!state.running) return;

  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  state.running = false;
  log.info("Stopped.");
}

/**
 * Check if the engine is running.
 */
export function isEngineRunning(): boolean {
  return getState().running;
}
