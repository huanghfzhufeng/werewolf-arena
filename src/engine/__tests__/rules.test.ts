import { describe, it, expect } from "vitest";
import { checkWinCondition, resolveVote } from "../rules";
import type { Player } from "@/db/schema";

function makePlayer(overrides: Partial<Player> & { id: string; role: string; isAlive: boolean }): Player {
  return {
    gameId: "game-1",
    agentId: null,
    agentName: `Agent-${overrides.id}`,
    personality: "{}",
    seatNumber: 1,
    ...overrides,
  } as Player;
}

describe("checkWinCondition", () => {
  it("villagers win when all wolves are dead", () => {
    const players = [
      makePlayer({ id: "1", role: "werewolf", isAlive: false }),
      makePlayer({ id: "2", role: "seer", isAlive: true }),
      makePlayer({ id: "3", role: "villager", isAlive: true }),
    ];
    const result = checkWinCondition(players);
    expect(result.finished).toBe(true);
    if (result.finished) expect(result.winner).toBe("villager");
  });

  it("werewolves win when alive wolves >= alive villagers", () => {
    const players = [
      makePlayer({ id: "1", role: "werewolf", isAlive: true }),
      makePlayer({ id: "2", role: "villager", isAlive: true }),
      makePlayer({ id: "3", role: "seer", isAlive: false }),
    ];
    const result = checkWinCondition(players);
    expect(result.finished).toBe(true);
    if (result.finished) expect(result.winner).toBe("werewolf");
  });

  it("game continues when villagers outnumber wolves", () => {
    const players = [
      makePlayer({ id: "1", role: "werewolf", isAlive: true }),
      makePlayer({ id: "2", role: "villager", isAlive: true }),
      makePlayer({ id: "3", role: "seer", isAlive: true }),
    ];
    expect(checkWinCondition(players).finished).toBe(false);
  });

  it("madman counts as werewolf team", () => {
    const players = [
      makePlayer({ id: "1", role: "werewolf", isAlive: false }),
      makePlayer({ id: "2", role: "madman", isAlive: true }),
      makePlayer({ id: "3", role: "villager", isAlive: true }),
    ];
    // madman alive + villager alive = 1 wolf team vs 1 villager → wolf wins
    const result = checkWinCondition(players);
    expect(result.finished).toBe(true);
    if (result.finished) expect(result.winner).toBe("werewolf");
  });
});

describe("resolveVote", () => {
  it("returns the player with the most votes", () => {
    const votes = [
      { voterId: "a", targetId: "x" },
      { voterId: "b", targetId: "x" },
      { voterId: "c", targetId: "y" },
    ];
    expect(resolveVote(votes)).toBe("x");
  });

  it("returns null on a tie", () => {
    const votes = [
      { voterId: "a", targetId: "x" },
      { voterId: "b", targetId: "y" },
    ];
    expect(resolveVote(votes)).toBeNull();
  });

  it("returns null when no votes", () => {
    expect(resolveVote([])).toBeNull();
  });

  it("handles single vote", () => {
    const votes = [{ voterId: "a", targetId: "x" }];
    expect(resolveVote(votes)).toBe("x");
  });
});
