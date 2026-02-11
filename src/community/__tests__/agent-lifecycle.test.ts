import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { decideToQueue, pickMode } from "../agent-lifecycle";
import type { Agent } from "@/db/schema";

// Mock config module
vi.mock("@/config", () => ({
  loadConfig: () => ({
    community: {
      baseQueueChance: 0.3,
      eagerBonusThreshold: 3,
      eagerBonusChance: 0.2,
      experiencedGameThreshold: 5,
      defaultModeWeights: {
        "classic-6p": 40,
        "standard-8p": 25,
        "advanced-12p": 10,
        "couples-9p": 15,
        "chaos-10p": 10,
      },
      experiencedModeWeights: {
        "classic-6p": 20,
        "standard-8p": 25,
        "advanced-12p": 20,
        "couples-9p": 15,
        "chaos-10p": 20,
      },
    },
  }),
}));

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "a1",
    name: "TestBot",
    personality: "{}",
    avatar: "🎭",
    status: "idle",
    cooldownUntil: null,
    totalGames: 0,
    totalWins: 0,
    winRate: 0,
    lastGameId: null,
    createdAt: new Date(),
    apiKey: null,
    ownerId: null,
    isSystem: false,
    bio: "",
    avatarUrl: null,
    elo: 1000,
    tags: [],
    webhookUrl: null,
    activeUntil: null,
    playMode: "hosted",
    ...overrides,
  } as Agent;
}

const testModes = [
  { id: "classic-6p", nameZh: "经典6人", playerCount: 6, descriptionZh: "", nightPhaseOrder: [], roleDistribution: [] },
  { id: "standard-8p", nameZh: "标准8人", playerCount: 8, descriptionZh: "", nightPhaseOrder: [], roleDistribution: [] },
];

describe("decideToQueue", () => {
  let mathRandomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mathRandomSpy = vi.spyOn(Math, "random");
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it("queues when roll < baseQueueChance for experienced agent", () => {
    // totalGames=10 (above eagerBonusThreshold=3), so only baseQueueChance=0.3
    mathRandomSpy.mockReturnValue(0.1); // 0.1 < 0.3
    expect(decideToQueue(makeAgent({ totalGames: 10 }))).toBe(true);
  });

  it("does not queue when roll > baseQueueChance for experienced agent", () => {
    mathRandomSpy.mockReturnValue(0.5); // 0.5 > 0.3
    expect(decideToQueue(makeAgent({ totalGames: 10 }))).toBe(false);
  });

  it("eager bonus increases chance for new agents", () => {
    // totalGames=1 < eagerBonusThreshold=3, so chance = 0.3 + 0.2 = 0.5
    mathRandomSpy.mockReturnValue(0.4); // 0.4 < 0.5
    expect(decideToQueue(makeAgent({ totalGames: 1 }))).toBe(true);
  });

  it("eager bonus does not apply for experienced agents", () => {
    mathRandomSpy.mockReturnValue(0.4); // 0.4 > 0.3 (no bonus)
    expect(decideToQueue(makeAgent({ totalGames: 10 }))).toBe(false);
  });
});

describe("pickMode", () => {
  let mathRandomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mathRandomSpy = vi.spyOn(Math, "random");
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it("returns a mode id", () => {
    mathRandomSpy.mockReturnValue(0.1);
    const result = pickMode(makeAgent(), testModes as any);
    expect(result).toBeTruthy();
    expect(["classic-6p", "standard-8p"]).toContain(result);
  });

  it("returns null for empty modes list", () => {
    expect(pickMode(makeAgent(), [] as any)).toBeNull();
  });

  it("favors classic-6p for new agents (highest weight)", () => {
    // With defaultModeWeights, classic-6p has weight 40 out of 65 total for our 2 modes
    // Roll 0.0 should pick classic-6p
    mathRandomSpy.mockReturnValue(0.0);
    const result = pickMode(makeAgent({ totalGames: 0 }), testModes as any);
    expect(result).toBe("classic-6p");
  });
});
