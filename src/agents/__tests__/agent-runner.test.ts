import { describe, it, expect } from "vitest";
import { resolvePlayerTarget } from "../agent-runner";
import type { Player } from "@/db/schema";

function makePlayer(overrides: Partial<Player> & { id: string; agentName: string }): Player {
  return {
    gameId: "game-1",
    agentId: null,
    role: "villager",
    isAlive: true,
    personality: "{}",
    seatNumber: 1,
    ...overrides,
  } as Player;
}

const players = [
  makePlayer({ id: "1", agentName: "鸣人", seatNumber: 1 }),
  makePlayer({ id: "2", agentName: "佐助", seatNumber: 2 }),
  makePlayer({ id: "3", agentName: "小樱", seatNumber: 3 }),
  makePlayer({ id: "4", agentName: "卡卡西", seatNumber: 4, isAlive: false }),
];

describe("resolvePlayerTarget", () => {
  it("exact name match", () => {
    expect(resolvePlayerTarget("鸣人", players)).toBe("1");
  });

  it("name embedded in sentence", () => {
    expect(resolvePlayerTarget("我投给佐助", players)).toBe("2");
  });

  it("ignores dead players", () => {
    expect(resolvePlayerTarget("卡卡西", players)).toBeUndefined();
  });

  it("excludes specified player id", () => {
    expect(resolvePlayerTarget("鸣人", players, "1")).toBeUndefined();
  });

  it("returns undefined for unknown name", () => {
    expect(resolvePlayerTarget("路飞", players)).toBeUndefined();
  });

  it("handles quoted names", () => {
    expect(resolvePlayerTarget('"小樱"', players)).toBe("3");
  });

  it("reverse match for longer input substrings", () => {
    // "鸣人" is only 2 chars so reverse match won't trigger (needs 3+)
    // but "佐助同学" contains "佐助" via forward match
    expect(resolvePlayerTarget("佐助同学", players)).toBe("2");
  });
});
