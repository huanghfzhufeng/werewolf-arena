import type { Player } from "@/db/schema";
import { ROLE_CONFIGS } from "./roles";

export type WinResult =
  | { finished: false }
  | { finished: true; winner: "werewolf" | "villager"; reason: string };

/**
 * Check if the game has ended.
 * - Werewolves win when alive wolves >= alive villagers
 * - Villagers win when all wolves are dead
 */
export function checkWinCondition(players: Player[]): WinResult {
  const alive = players.filter((p) => p.isAlive);
  const aliveWolves = alive.filter(
    (p) => p.role && ROLE_CONFIGS[p.role as keyof typeof ROLE_CONFIGS]?.team === "werewolf"
  );
  const aliveVillagers = alive.filter(
    (p) => p.role && ROLE_CONFIGS[p.role as keyof typeof ROLE_CONFIGS]?.team === "villager"
  );

  if (aliveWolves.length === 0) {
    return {
      finished: true,
      winner: "villager",
      reason: "所有狼人已被淘汰，好人阵营胜利！",
    };
  }

  if (aliveWolves.length >= aliveVillagers.length) {
    return {
      finished: true,
      winner: "werewolf",
      reason: `狼人数量(${aliveWolves.length})≥村民数量(${aliveVillagers.length})，狼人阵营胜利！`,
    };
  }

  return { finished: false };
}

/**
 * Resolve a vote: returns the player ID with the most votes,
 * or null if there's a tie.
 */
export function resolveVote(
  votePairs: { voterId: string; targetId: string }[]
): string | null {
  const tally = new Map<string, number>();
  for (const { targetId } of votePairs) {
    tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
  }

  if (tally.size === 0) return null;

  let maxVotes = 0;
  let maxTargets: string[] = [];
  for (const [targetId, count] of tally) {
    if (count > maxVotes) {
      maxVotes = count;
      maxTargets = [targetId];
    } else if (count === maxVotes) {
      maxTargets.push(targetId);
    }
  }

  // Tie → no elimination
  if (maxTargets.length > 1) return null;
  return maxTargets[0];
}
