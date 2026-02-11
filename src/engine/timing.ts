import { loadConfig } from "@/config";

/**
 * Game pacing configuration — controls delays between events
 * to create a natural "live broadcast" feel.
 *
 * Values are driven by the config system (game-config.json / defaults).
 */
function getTimingConfig() {
  const t = loadConfig().timing;
  return {
    PHASE_TRANSITION: t.phaseTransition,
    BEFORE_SPEAK: t.beforeSpeak,
    AFTER_SPEAK: t.afterSpeak,
    BEFORE_VOTE: t.beforeVote,
    VOTE_REVEAL_INTERVAL: t.voteRevealInterval,
    DEATH_ANNOUNCEMENT: t.deathAnnouncement,
    LAST_WORDS: t.lastWords,
    GAME_OVER: t.gameOver,
  } as const;
}

/** Lazy proxy so existing `TIMING.X` usage keeps working. */
export const TIMING = new Proxy(
  {} as ReturnType<typeof getTimingConfig>,
  {
    get(_target, prop: string) {
      return (getTimingConfig() as Record<string, number>)[prop];
    },
  }
);

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
