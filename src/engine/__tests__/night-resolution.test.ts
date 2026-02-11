import { describe, it, expect } from "vitest";
import { resolveNightActions } from "../state-machine";
import type { Player } from "@/db/schema";

function makePlayer(overrides: Partial<Player> & { id: string; role: string }): Player {
  return {
    gameId: "game-1",
    agentId: null,
    agentName: `Agent-${overrides.id}`,
    isAlive: true,
    personality: "{}",
    seatNumber: 1,
    ...overrides,
  } as Player;
}

const villager = makePlayer({ id: "v1", role: "villager" });
const elder = makePlayer({ id: "e1", role: "elder" });
const wolf = makePlayer({ id: "w1", role: "werewolf" });
const allPlayers = [villager, elder, wolf];

describe("resolveNightActions", () => {
  it("wolf kills target when no protection", () => {
    const result = resolveNightActions("v1", null, false, null, allPlayers, false);
    expect(result.deaths).toEqual([{ playerId: "v1", cause: "wolf_kill" }]);
    expect(result.elderUsedThisRound).toBe(false);
  });

  it("guard protects wolf target → no death", () => {
    const result = resolveNightActions("v1", "v1", false, null, allPlayers, false);
    expect(result.deaths).toHaveLength(0);
  });

  it("witch saves wolf target → no death", () => {
    const result = resolveNightActions("v1", null, true, null, allPlayers, false);
    expect(result.deaths).toHaveLength(0);
  });

  it("elder survives first wolf kill with extra life", () => {
    const result = resolveNightActions("e1", null, false, null, allPlayers, false);
    expect(result.deaths).toHaveLength(0);
    expect(result.elderUsedThisRound).toBe(true);
  });

  it("elder dies on second wolf kill (extra life already used)", () => {
    const result = resolveNightActions("e1", null, false, null, allPlayers, true);
    expect(result.deaths).toEqual([{ playerId: "e1", cause: "wolf_kill" }]);
    expect(result.elderUsedThisRound).toBe(false);
  });

  it("witch poison adds a separate death", () => {
    const result = resolveNightActions("v1", null, false, "e1", allPlayers, false);
    expect(result.deaths).toEqual([
      { playerId: "v1", cause: "wolf_kill" },
      { playerId: "e1", cause: "witch_poison" },
    ]);
  });

  it("witch poison does not duplicate if same as wolf target", () => {
    const result = resolveNightActions("v1", null, false, "v1", allPlayers, false);
    expect(result.deaths).toHaveLength(1);
    expect(result.deaths[0].cause).toBe("wolf_kill");
  });

  it("no wolf target and no poison → peaceful night", () => {
    const result = resolveNightActions(null, null, false, null, allPlayers, false);
    expect(result.deaths).toHaveLength(0);
  });

  it("guard + elder: guard saves elder so elder doesn't need extra life", () => {
    const result = resolveNightActions("e1", "e1", false, null, allPlayers, false);
    expect(result.deaths).toHaveLength(0);
    expect(result.elderUsedThisRound).toBe(false);
  });
});
