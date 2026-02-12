import { describe, it, expect } from "vitest";
import { resolvePlayerTarget, parseLLMTurnResponse } from "../agent-runner";
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

describe("parseLLMTurnResponse", () => {
  const actor = players[0];

  it("parses speak message", () => {
    const result = parseLLMTurnResponse(
      "MESSAGE: 我先听一轮再判断。",
      "speak",
      players,
      actor
    );
    expect(result).toEqual({ message: "我先听一轮再判断。" });
  });

  it("parses targeted vote output", () => {
    const result = parseLLMTurnResponse(
      "TARGET: 佐助",
      "vote",
      players,
      actor
    );
    expect(result).toEqual({ targetId: "2" });
  });

  it("parses witch poison action with target", () => {
    const result = parseLLMTurnResponse(
      "ACTION: poison\nTARGET: 小樱",
      "witch_decide",
      players,
      actor
    );
    expect(result).toEqual({ witchAction: "poison", targetId: "3" });
  });

  it("parses knight flip action", () => {
    const result = parseLLMTurnResponse(
      "FLIP: true\nTARGET: 佐助",
      "knight_speak",
      players,
      actor
    );
    expect(result).toEqual({ knightCheck: true, targetId: "2", message: undefined });
  });

  it("parses cupid pair from mentions", () => {
    const result = parseLLMTurnResponse(
      "我选择把 佐助 和 小樱 连成情侣",
      "cupid_link",
      players,
      actor
    );
    expect(result).toEqual({ targetId: "2", secondTargetId: "3" });
  });
});
