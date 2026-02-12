import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { games, players, messages, votes, actions } from "@/db/schema";
import type { Player } from "@/db/schema";
import { emit } from "./events";
import { ROLE_CONFIGS, shuffleArray, isWerewolfTeam } from "./roles";
import type { Role } from "./roles";
import { checkWinCondition, resolveVote } from "./rules";
import { runAgentTurn } from "@/agents/agent-runner";
import { delay, TIMING } from "./timing";
import {
  narrateGameStart,
  narrateNightFall,
  narrateDayBreak,
  narrateVoteResult,
  narrateGameOver,
  narrateRoleWake,
  narrateRoleSleep,
  narrateSpeakerIntro,
  narrateDiscussionStart,
  narrateVoteStart,
  narrateLastWordsIntro,
} from "./narrator";
import { getGameMode } from "./game-modes";
import { onGameEnd } from "@/community/game-end-hook";
import { createLogger } from "@/lib";
import { triggerGameHook, clearGameEvents } from "@/skills";

const log = createLogger("Engine");

export type Phase =
  | "lobby"
  | "night_cupid"
  | "night_werewolf"
  | "night_enchant"
  | "night_seer"
  | "night_witch"
  | "night_guard"
  | "night_dreamweaver"
  | "day_announce"
  | "day_discuss"
  | "day_vote"
  | "check_win"
  | "game_over";

type DeathCause =
  | "wolf_kill"
  | "witch_poison"
  | "hunter_shoot"
  | "wolf_king_revenge"
  | "white_wolf_explode"
  | "couple_heartbreak"
  | "knight_check"
  | "vote";

// ─── Helpers ────────────────────────────────────────────────────

async function updatePhase(gameId: string, phase: Phase, round?: number) {
  const updates: Record<string, unknown> = { currentPhase: phase };
  if (round !== undefined) updates.currentRound = round;
  await db.update(games).set(updates).where(eq(games.id, gameId));
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  emit({
    type: "phase_change",
    gameId,
    round: game.currentRound,
    timestamp: new Date().toISOString(),
    data: { phase, round: game.currentRound },
  });
}

async function addSystemMessage(
  gameId: string,
  round: number,
  phase: Phase,
  content: string
) {
  await db.insert(messages).values({ gameId, round, phase, content, isSystem: true });
  emit({
    type: "message",
    gameId,
    round,
    timestamp: new Date().toISOString(),
    data: { content, isSystem: true },
  });
}

async function getAllPlayers(gameId: string): Promise<Player[]> {
  return db.select().from(players).where(eq(players.gameId, gameId));
}

async function killPlayer(gameId: string, playerId: string, round: number) {
  await db.update(players).set({ isAlive: false }).where(eq(players.id, playerId));
  const [victim] = await db.select().from(players).where(eq(players.id, playerId));
  emit({
    type: "death",
    gameId,
    round,
    timestamp: new Date().toISOString(),
    data: { playerId, playerName: victim.agentName, role: victim.role },
  });
}

// ─── Ability State Queries ──────────────────────────────────────

async function hasWitchUsedSave(gameId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(actions)
    .where(and(eq(actions.gameId, gameId), eq(actions.actionType, "witch_save")));
  return rows.length > 0;
}

async function hasWitchUsedPoison(gameId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(actions)
    .where(and(eq(actions.gameId, gameId), eq(actions.actionType, "witch_poison")));
  return rows.length > 0;
}

async function getLastGuardTarget(gameId: string, guardId: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(actions)
    .where(
      and(
        eq(actions.gameId, gameId),
        eq(actions.playerId, guardId),
        eq(actions.actionType, "guard_protect")
      )
    )
    .orderBy(desc(actions.createdAt))
    .limit(1);
  return rows.length > 0 ? rows[0].targetId : null;
}

// ─── Idiot / Knight State Queries ────────────────────────────────

async function hasIdiotRevealed(gameId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(actions)
    .where(and(eq(actions.gameId, gameId), eq(actions.actionType, "idiot_reveal")));
  return rows.length > 0;
}

async function hasKnightUsedCheck(gameId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(actions)
    .where(and(eq(actions.gameId, gameId), eq(actions.actionType, "knight_check")));
  return rows.length > 0;
}

// ─── Couple Tracking (DB-backed) ────────────────────────────────

async function getPartner(gameId: string, playerId: string): Promise<string | null> {
  const [cupidAction] = await db
    .select()
    .from(actions)
    .where(and(eq(actions.gameId, gameId), eq(actions.actionType, "cupid_link")))
    .limit(1);
  if (!cupidAction || !cupidAction.targetId || !cupidAction.result) return null;

  const lover1 = cupidAction.targetId;
  const lover2 = cupidAction.result;
  if (lover1 === playerId) return lover2;
  if (lover2 === playerId) return lover1;
  return null;
}

// ─── Night Phase Runners ────────────────────────────────────────

async function runCupidNight(
  gameId: string,
  round: number,
  allPlayers: Player[]
): Promise<void> {
  if (round !== 1) return; // Cupid only acts on the first night
  await updatePhase(gameId, "night_cupid");
  const cupid = allPlayers.find((p) => p.isAlive && p.role === "cupid");
  if (!cupid) return;

  emit({
    type: "thinking",
    gameId,
    round,
    timestamp: new Date().toISOString(),
    data: { playerId: cupid.id, playerName: cupid.agentName },
  });
  await delay(TIMING.BEFORE_SPEAK);

  const result = await runAgentTurn({
    gameId,
    player: cupid,
    allPlayers,
    phase: "night_cupid",
    round,
    actionType: "cupid_link",
  });

  // result.targetId = lover1, result.secondTargetId = lover2
  const lover1 = result.targetId;
  const lover2 = result.secondTargetId;
  if (lover1 && lover2 && lover1 !== lover2) {
    await db.insert(actions).values({
      gameId,
      round,
      playerId: cupid.id,
      actionType: "cupid_link",
      targetId: lover1,
      result: lover2, // store second lover in result
    });
    const l1 = allPlayers.find((p) => p.id === lover1);
    const l2 = allPlayers.find((p) => p.id === lover2);
    emit({
      type: "message",
      gameId,
      round,
      timestamp: new Date().toISOString(),
      data: {
        content: `💘 丘比特将 ${l1?.agentName} 和 ${l2?.agentName} 连接为情侣！`,
        isSystem: true,
        isPrivate: true,
      },
    });
  }
}

async function runGuardNight(
  gameId: string,
  round: number,
  allPlayers: Player[]
): Promise<string | null> {
  await updatePhase(gameId, "night_guard");
  const guard = allPlayers.find((p) => p.isAlive && p.role === "guard");
  if (!guard) return null;

  const lastTarget = await getLastGuardTarget(gameId, guard.id);

  emit({
    type: "thinking",
    gameId,
    round,
    timestamp: new Date().toISOString(),
    data: { playerId: guard.id, playerName: guard.agentName },
  });
  await delay(TIMING.BEFORE_SPEAK);

  const result = await runAgentTurn({
    gameId,
    player: guard,
    allPlayers,
    phase: "night_guard",
    round,
    actionType: "guard_protect",
    extraContext: { lastProtectedId: lastTarget },
  });

  if (result.targetId) {
    // Server-side enforcement: cannot protect same player two nights in a row
    if (result.targetId === lastTarget) {
      log.warn(`Guard ${guard.agentName} tried to protect same target consecutively. Skipping.`);
      return null;
    }
    await db.insert(actions).values({
      gameId,
      round,
      playerId: guard.id,
      actionType: "guard_protect",
      targetId: result.targetId,
      result: "protected",
    });
    await triggerGameHook({
      type: "guard_protect",
      gameId,
      round,
      data: { guardId: guard.id, protectedId: result.targetId },
    });
    return result.targetId;
  }
  return null;
}

async function runWerewolfNight(
  gameId: string,
  round: number,
  allPlayers: Player[]
): Promise<string | null> {
  await updatePhase(gameId, "night_werewolf", round);
  // Exclude madman — they don't participate in wolf night action
  const aliveWolves = allPlayers.filter(
    (p) => p.isAlive && p.role && isWerewolfTeam(p.role as Role) && p.role !== "madman"
  );
  if (aliveWolves.length === 0) return null;

  const wolfVotes: { voterId: string; targetId: string }[] = [];
  for (const wolf of aliveWolves) {
    emit({
      type: "thinking",
      gameId,
      round,
      timestamp: new Date().toISOString(),
      data: { playerId: wolf.id, playerName: wolf.agentName },
    });
    await delay(TIMING.BEFORE_SPEAK);

    const result = await runAgentTurn({
      gameId,
      player: wolf,
      allPlayers,
      phase: "night_werewolf",
      round,
      actionType: "choose_kill_target",
    });
    if (result.targetId) {
      wolfVotes.push({ voterId: wolf.id, targetId: result.targetId });
      await db.insert(votes).values({
        gameId,
        round,
        voterId: wolf.id,
        targetId: result.targetId,
        phase: "night_werewolf",
      });
    }
    if (result.message) {
      await db.insert(messages).values({
        gameId,
        round,
        phase: "night_werewolf",
        playerId: wolf.id,
        content: result.message,
        isPrivate: true,
      });
      emit({
        type: "message",
        gameId,
        round,
        timestamp: new Date().toISOString(),
        data: {
          playerId: wolf.id,
          playerName: wolf.agentName,
          content: result.message,
          isPrivate: true,
        },
      });
      await delay(TIMING.AFTER_SPEAK);
    }
  }
  const wolfTarget = resolveVote(wolfVotes);
  if (wolfTarget) {
    const victimName = allPlayers.find((p) => p.id === wolfTarget)?.agentName ?? null;
    await triggerGameHook({
      type: "werewolf_kill",
      gameId,
      round,
      data: { wolfVictimId: wolfTarget, wolfVictimName: victimName },
    });
  }
  return wolfTarget;
}

async function runWitchNight(
  gameId: string,
  round: number,
  allPlayers: Player[],
  wolfTarget: string | null
): Promise<{ saved: boolean; poisonTarget: string | null }> {
  await updatePhase(gameId, "night_witch");
  const witch = allPlayers.find((p) => p.isAlive && p.role === "witch");
  if (!witch) return { saved: false, poisonTarget: null };

  const saveUsed = await hasWitchUsedSave(gameId);
  const poisonUsed = await hasWitchUsedPoison(gameId);
  if (saveUsed && poisonUsed) return { saved: false, poisonTarget: null };

  const wolfVictimName = wolfTarget
    ? allPlayers.find((p) => p.id === wolfTarget)?.agentName ?? null
    : null;

  emit({
    type: "thinking",
    gameId,
    round,
    timestamp: new Date().toISOString(),
    data: { playerId: witch.id, playerName: witch.agentName },
  });
  await delay(TIMING.BEFORE_SPEAK);

  const result = await runAgentTurn({
    gameId,
    player: witch,
    allPlayers,
    phase: "night_witch",
    round,
    actionType: "witch_decide",
    extraContext: {
      wolfVictimName,
      wolfVictimId: wolfTarget,
      hasSavePotion: !saveUsed,
      hasPoisonPotion: !poisonUsed,
    },
  });

  let saved = false;
  let poisonTarget: string | null = null;

  if (result.witchAction === "save" && !saveUsed && wolfTarget) {
    saved = true;
    await db.insert(actions).values({
      gameId,
      round,
      playerId: witch.id,
      actionType: "witch_save",
      targetId: wolfTarget,
      result: "saved",
    });
    emit({
      type: "witch_action",
      gameId,
      round,
      timestamp: new Date().toISOString(),
      data: { action: "save", targetName: wolfVictimName },
    });
    await triggerGameHook({ type: "witch_save", gameId, round, data: { targetId: wolfTarget } });
  } else if (result.witchAction === "poison" && !poisonUsed && result.targetId) {
    poisonTarget = result.targetId;
    await db.insert(actions).values({
      gameId,
      round,
      playerId: witch.id,
      actionType: "witch_poison",
      targetId: result.targetId,
      result: "poisoned",
    });
    emit({
      type: "witch_action",
      gameId,
      round,
      timestamp: new Date().toISOString(),
      data: {
        action: "poison",
        targetName: allPlayers.find((p) => p.id === result.targetId)?.agentName,
      },
    });
    await triggerGameHook({ type: "witch_poison", gameId, round, data: { targetId: result.targetId } });
  }

  return { saved, poisonTarget };
}

async function runSeerNight(
  gameId: string,
  round: number,
  allPlayers: Player[],
  enchanted: boolean = false
): Promise<void> {
  await updatePhase(gameId, "night_seer");
  const seer = allPlayers.find((p) => p.isAlive && p.role === "seer");
  if (!seer) return;

  emit({
    type: "thinking",
    gameId,
    round,
    timestamp: new Date().toISOString(),
    data: { playerId: seer.id, playerName: seer.agentName },
  });
  await delay(TIMING.BEFORE_SPEAK);

  const result = await runAgentTurn({
    gameId,
    player: seer,
    allPlayers,
    phase: "night_seer",
    round,
    actionType: "seer_check",
  });

  if (result.targetId) {
    const target = allPlayers.find((p) => p.id === result.targetId);
    // Madman appears as "good" to seer
    const targetRole = target?.role as Role | undefined;
    let isWolf = targetRole
      ? (isWerewolfTeam(targetRole) && targetRole !== "madman")
      : false;

    // If enchanted, randomize the result — seer gets unreliable info
    if (enchanted) {
      isWolf = Math.random() < 0.5;
    }

    await db.insert(actions).values({
      gameId,
      round,
      playerId: seer.id,
      actionType: "seer_check",
      targetId: result.targetId,
      result: isWolf ? "werewolf" : "villager",
    });
    emit({
      type: "seer_result",
      gameId,
      round,
      timestamp: new Date().toISOString(),
      data: {
        seerId: seer.id,
        targetId: result.targetId,
        targetName: target?.agentName,
        result: isWolf ? "werewolf" : "villager",
      },
    });
    await triggerGameHook({
      type: "seer_check",
      gameId,
      round,
      data: { seerId: seer.id, targetId: result.targetId, result: isWolf ? "werewolf" : "villager" },
    });
  }
}

// ─── Enchantress Night Phase ─────────────────────────────────────

async function runEnchantNight(
  gameId: string,
  round: number,
  allPlayers: Player[]
): Promise<string | null> {
  await updatePhase(gameId, "night_enchant");
  const enchantress = allPlayers.find(
    (p) => p.isAlive && p.role === "enchantress"
  );
  if (!enchantress) return null;

  emit({
    type: "thinking",
    gameId,
    round,
    timestamp: new Date().toISOString(),
    data: { playerId: enchantress.id, playerName: enchantress.agentName },
  });
  await delay(TIMING.BEFORE_SPEAK);

  const result = await runAgentTurn({
    gameId,
    player: enchantress,
    allPlayers,
    phase: "night_enchant",
    round,
    actionType: "enchant_target",
  });

  if (result.targetId) {
    const target = allPlayers.find((p) => p.id === result.targetId);
    // Cannot enchant fellow wolves
    const targetRole = target?.role as Role | undefined;
    if (targetRole && isWerewolfTeam(targetRole)) {
      log.warn(`Enchantress tried to enchant wolf-team player. Skipping.`);
      return null;
    }
    await db.insert(actions).values({
      gameId,
      round,
      playerId: enchantress.id,
      actionType: "enchant_target",
      targetId: result.targetId,
      result: "enchanted",
    });
    emit({
      type: "enchant_action",
      gameId,
      round,
      timestamp: new Date().toISOString(),
      data: {
        enchantressId: enchantress.id,
        targetId: result.targetId,
        targetName: target?.agentName,
      },
    });
    await triggerGameHook({
      type: "enchant_action",
      gameId,
      round,
      data: { enchantressId: enchantress.id, targetId: result.targetId },
    });
    return result.targetId;
  }
  return null;
}

// ─── Dream Weaver Night Phase ────────────────────────────────────

async function getLastDreamweaverPairKey(
  gameId: string,
  dreamweaverId: string
): Promise<string | null> {
  const rows = await db
    .select()
    .from(actions)
    .where(
      and(
        eq(actions.gameId, gameId),
        eq(actions.playerId, dreamweaverId),
        eq(actions.actionType, "dreamweaver_check")
      )
    )
    .orderBy(desc(actions.createdAt))
    .limit(1);
  return rows.length > 0 ? rows[0].result : null;
}

async function runDreamweaverNight(
  gameId: string,
  round: number,
  allPlayers: Player[],
  enchantTarget: string | null
): Promise<void> {
  await updatePhase(gameId, "night_dreamweaver");
  const dw = allPlayers.find((p) => p.isAlive && p.role === "dreamweaver");
  if (!dw) return;

  // If enchanted, ability is nullified
  if (enchantTarget === dw.id) {
    log.info(`Dream Weaver ${dw.agentName} is enchanted — ability nullified.`);
    return;
  }

  const lastPairKey = await getLastDreamweaverPairKey(gameId, dw.id);

  emit({
    type: "thinking",
    gameId,
    round,
    timestamp: new Date().toISOString(),
    data: { playerId: dw.id, playerName: dw.agentName },
  });
  await delay(TIMING.BEFORE_SPEAK);

  const result = await runAgentTurn({
    gameId,
    player: dw,
    allPlayers,
    phase: "night_dreamweaver",
    round,
    actionType: "dreamweaver_check",
    extraContext: { lastDreamweaverPairKey: lastPairKey },
  });

  if (result.targetId && result.secondTargetId && result.targetId !== result.secondTargetId) {
    // Build a canonical pair key (sorted IDs)
    const pairKey = [result.targetId, result.secondTargetId].sort().join(":");

    // Prevent checking same pair consecutively
    if (pairKey === lastPairKey) {
      log.warn(`Dream Weaver tried to check same pair consecutively. Skipping.`);
      return;
    }

    const t1 = allPlayers.find((p) => p.id === result.targetId);
    const t2 = allPlayers.find((p) => p.id === result.secondTargetId);
    const t1Role = t1?.role as Role | undefined;
    const t2Role = t2?.role as Role | undefined;
    const t1Team = t1Role ? ROLE_CONFIGS[t1Role].team : null;
    const t2Team = t2Role ? ROLE_CONFIGS[t2Role].team : null;
    const sameTeam = t1Team !== null && t2Team !== null && t1Team === t2Team;

    await db.insert(actions).values({
      gameId,
      round,
      playerId: dw.id,
      actionType: "dreamweaver_check",
      targetId: result.targetId,
      result: pairKey, // store pair key for consecutive-check prevention
    });
    emit({
      type: "dreamweaver_result",
      gameId,
      round,
      timestamp: new Date().toISOString(),
      data: {
        dreamweaverId: dw.id,
        target1Id: result.targetId,
        target1Name: t1?.agentName,
        target2Id: result.secondTargetId,
        target2Name: t2?.agentName,
        result: sameTeam ? "same_team" : "different_team",
      },
    });
    await triggerGameHook({
      type: "dreamweaver_check",
      gameId,
      round,
      data: {
        dreamweaverId: dw.id,
        target1Id: result.targetId,
        target2Id: result.secondTargetId,
        result: sameTeam ? "same_team" : "different_team",
      },
    });
  }
}

// ─── Night Resolution ───────────────────────────────────────────────

/** @internal Exported for testing */
export function resolveNightActions(
  wolfTarget: string | null,
  guardTarget: string | null,
  witchSaved: boolean,
  witchPoisonTarget: string | null,
  allPlayers: Player[],
  elderExtraLifeUsed: boolean,
  enchantTarget: string | null = null
): {
  deaths: { playerId: string; cause: DeathCause }[];
  elderUsedThisRound: boolean;
} {
  const deaths: { playerId: string; cause: DeathCause }[] = [];
  let elderUsed = false;

  // If guard is enchanted, their protection is nullified
  const effectiveGuardTarget = (enchantTarget && guardTarget && enchantTarget === guardTarget)
    ? null
    : guardTarget;

  if (wolfTarget) {
    let killed = true;
    if (effectiveGuardTarget === wolfTarget) killed = false;
    if (witchSaved) killed = false;

    if (killed) {
      const target = allPlayers.find((p) => p.id === wolfTarget);
      if (target?.role === "elder" && !elderExtraLifeUsed) {
        killed = false;
        elderUsed = true;
      }
    }

    if (killed) {
      deaths.push({ playerId: wolfTarget, cause: "wolf_kill" });
    }
  }

  if (witchPoisonTarget) {
    if (!deaths.find((d) => d.playerId === witchPoisonTarget)) {
      deaths.push({ playerId: witchPoisonTarget, cause: "witch_poison" });
    }
  }

  return { deaths, elderUsedThisRound: elderUsed };
}

// ─── Death Triggers ─────────────────────────────────────────────

async function handleDeathTrigger(
  gameId: string,
  round: number,
  victim: Player,
  cause: DeathCause,
  abilitiesStripped: boolean,
  depth: number = 0
): Promise<void> {
  if (depth >= 3) return;
  const role = victim.role as Role;
  if (!role) return;
  const config = ROLE_CONFIGS[role];
  if (!config.deathTrigger) return;

  // Hunter: NOT triggered by poison
  if (config.deathTrigger === "hunter_shoot" && cause !== "witch_poison" && !abilitiesStripped) {
    const allPlayers = await getAllPlayers(gameId);
    emit({
      type: "thinking",
      gameId,
      round,
      timestamp: new Date().toISOString(),
      data: { playerId: victim.id, playerName: victim.agentName },
    });
    await delay(TIMING.BEFORE_SPEAK);

    const result = await runAgentTurn({
      gameId,
      player: victim,
      allPlayers,
      phase: "day_announce",
      round,
      actionType: "hunter_shoot",
    });

    if (result.targetId) {
      const shootTarget = allPlayers.find((p) => p.id === result.targetId);
      await db.insert(actions).values({
        gameId,
        round,
        playerId: victim.id,
        actionType: "hunter_shoot",
        targetId: result.targetId,
        result: "shot",
      });
      await killPlayer(gameId, result.targetId, round);
      await addSystemMessage(
        gameId,
        round,
        "day_announce",
        `🔫 猎人 ${victim.agentName} 发动技能，开枪带走了 ${shootTarget?.agentName}！`
      );
      emit({
        type: "hunter_shoot",
        gameId,
        round,
        timestamp: new Date().toISOString(),
        data: {
          hunterId: victim.id,
          hunterName: victim.agentName,
          targetId: result.targetId,
          targetName: shootTarget?.agentName,
        },
      });
      await delay(TIMING.DEATH_ANNOUNCEMENT);

      if (shootTarget) {
        await handleDeathTrigger(gameId, round, shootTarget, "hunter_shoot", abilitiesStripped, depth + 1);
      }
    }
  }

  // White Wolf King: on vote (like wolf_king)
  if (config.deathTrigger === "white_wolf_explode" && cause === "vote") {
    const allPlayers = await getAllPlayers(gameId);
    emit({
      type: "thinking",
      gameId,
      round,
      timestamp: new Date().toISOString(),
      data: { playerId: victim.id, playerName: victim.agentName },
    });
    await delay(TIMING.BEFORE_SPEAK);

    const result = await runAgentTurn({
      gameId,
      player: victim,
      allPlayers,
      phase: "day_vote",
      round,
      actionType: "wolf_king_revenge", // reuse same prompt
    });

    if (result.targetId) {
      const explodeTarget = allPlayers.find((p) => p.id === result.targetId);
      await db.insert(actions).values({
        gameId,
        round,
        playerId: victim.id,
        actionType: "white_wolf_explode",
        targetId: result.targetId,
        result: "exploded",
      });
      await killPlayer(gameId, result.targetId, round);
      await addSystemMessage(
        gameId,
        round,
        "day_vote",
        `🐺 白狼王 ${victim.agentName} 自爆，带走了 ${explodeTarget?.agentName}！`
      );
      emit({
        type: "wolf_king_revenge",
        gameId,
        round,
        timestamp: new Date().toISOString(),
        data: {
          wolfKingId: victim.id,
          wolfKingName: victim.agentName,
          targetId: result.targetId,
          targetName: explodeTarget?.agentName,
        },
      });
      await delay(TIMING.DEATH_ANNOUNCEMENT);

      // Handle couple heartbreak
      await handleCoupleHeartbreak(gameId, round, result.targetId, abilitiesStripped, depth + 1);

      if (explodeTarget) {
        await handleDeathTrigger(gameId, round, explodeTarget, "white_wolf_explode", abilitiesStripped, depth + 1);
      }
    }
  }

  // Wolf King: ONLY on vote
  if (config.deathTrigger === "wolf_king_revenge" && cause === "vote") {
    const allPlayers = await getAllPlayers(gameId);
    emit({
      type: "thinking",
      gameId,
      round,
      timestamp: new Date().toISOString(),
      data: { playerId: victim.id, playerName: victim.agentName },
    });
    await delay(TIMING.BEFORE_SPEAK);

    const result = await runAgentTurn({
      gameId,
      player: victim,
      allPlayers,
      phase: "day_vote",
      round,
      actionType: "wolf_king_revenge",
    });

    if (result.targetId) {
      const revengeTarget = allPlayers.find((p) => p.id === result.targetId);
      await db.insert(actions).values({
        gameId,
        round,
        playerId: victim.id,
        actionType: "wolf_king_revenge",
        targetId: result.targetId,
        result: "revenge",
      });
      await killPlayer(gameId, result.targetId, round);
      await addSystemMessage(
        gameId,
        round,
        "day_vote",
        `👑 狼王 ${victim.agentName} 发动技能，带走了 ${revengeTarget?.agentName}！`
      );
      emit({
        type: "wolf_king_revenge",
        gameId,
        round,
        timestamp: new Date().toISOString(),
        data: {
          wolfKingId: victim.id,
          wolfKingName: victim.agentName,
          targetId: result.targetId,
          targetName: revengeTarget?.agentName,
        },
      });
      await delay(TIMING.DEATH_ANNOUNCEMENT);

      // Handle couple heartbreak
      await handleCoupleHeartbreak(gameId, round, result.targetId, abilitiesStripped, depth + 1);

      if (revengeTarget) {
        await handleDeathTrigger(gameId, round, revengeTarget, "wolf_king_revenge", abilitiesStripped, depth + 1);
      }
    }
  }
}

// ─── Couple Heartbreak ─────────────────────────────────────

async function handleCoupleHeartbreak(
  gameId: string,
  round: number,
  deadPlayerId: string,
  abilitiesStripped: boolean,
  depth: number = 0
): Promise<void> {
  if (depth >= 5) return;
  const partner = await getPartner(gameId, deadPlayerId);
  if (!partner) return;

  const allPlayers = await getAllPlayers(gameId);
  const partnerPlayer = allPlayers.find((p) => p.id === partner);
  if (!partnerPlayer || !partnerPlayer.isAlive) return;

  await killPlayer(gameId, partner, round);
  await addSystemMessage(
    gameId,
    round,
    "day_announce",
    `💔 ${partnerPlayer.agentName} 因情侣 殉情而死！`
  );
  await delay(TIMING.DEATH_ANNOUNCEMENT);

  // The heartbroken partner can also trigger death effects
  await handleDeathTrigger(gameId, round, partnerPlayer, "couple_heartbreak", abilitiesStripped, depth + 1);
}

// ─── Game Start ─────────────────────────────────────────────────

export async function startGame(gameId: string) {
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  const mode = getGameMode(game.modeId);
  const gamePlayers = await getAllPlayers(gameId);

  if (gamePlayers.length !== mode.playerCount) {
    throw new Error(`${mode.nameZh} requires ${mode.playerCount} players, got ${gamePlayers.length}`);
  }

  const shuffled = shuffleArray(mode.roleDistribution);
  for (let i = 0; i < gamePlayers.length; i++) {
    await db
      .update(players)
      .set({ role: shuffled[i] })
      .where(eq(players.id, gamePlayers[i].id));
  }

  const firstPhase = mode.nightPhaseOrder[0] as Phase;
  await db
    .update(games)
    .set({ status: "playing", currentRound: 1, currentPhase: firstPhase })
    .where(eq(games.id, gameId));

  emit({
    type: "game_start",
    gameId,
    round: 1,
    timestamp: new Date().toISOString(),
    data: {
      modeId: mode.id,
      modeName: mode.nameZh,
      players: gamePlayers.map((p) => ({
        id: p.id,
        name: p.agentName,
        seat: p.seatNumber,
      })),
    },
  });

  const startNarration = await narrateGameStart(
    mode.nameZh,
    mode.playerCount,
    gamePlayers.map((p) => p.agentName)
  );
  await addSystemMessage(gameId, 1, firstPhase, startNarration);

  runGameLoop(gameId).catch((err) => {
    log.error(`Fatal error in game ${gameId}:`, err);
    recoverCrashedGame(gameId).catch((e) => log.error("Recovery failed:", e));
  });
}

const MAX_ROUNDS = 20;

// ─── Main Game Loop ─────────────────────────────────────────────

export async function runGameLoop(gameId: string) {
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  const mode = getGameMode(game.modeId);
  let round = game.currentRound;

  // Recover elder/abilities state from DB (survives hot-reload)
  const elderDeaths = await db
    .select()
    .from(players)
    .where(and(eq(players.gameId, gameId), eq(players.role, "elder")));
  const elderPlayer = elderDeaths[0];
  // Check if elder already used extra life (persisted as an action record)
  const elderLifeActions = elderPlayer
    ? await db.select().from(actions).where(
        and(eq(actions.gameId, gameId), eq(actions.actionType, "elder_extra_life"))
      )
    : [];
  let elderExtraLifeUsed = elderLifeActions.length > 0;

  // If elder was voted out, abilities are stripped
  const elderVotedOut = elderPlayer && !elderPlayer.isAlive;
  const elderVoteDeaths = elderVotedOut
    ? await db.select().from(votes).where(
        and(eq(votes.gameId, gameId), eq(votes.targetId, elderPlayer.id), eq(votes.phase, "day_vote"))
      )
    : [];
  let abilitiesStripped = elderVoteDeaths.length > 0;

  while (round <= MAX_ROUNDS) {
    // ── NIGHT ──
    let roundPlayers = await getAllPlayers(gameId);
    const nightNarration = await narrateNightFall(
      round,
      roundPlayers.filter((p) => p.isAlive).length
    );
    emit({
      type: "night_fall",
      gameId,
      round,
      timestamp: new Date().toISOString(),
      data: { description: nightNarration },
    });
    await delay(TIMING.PHASE_TRANSITION);

    let wolfTarget: string | null = null;
    let guardTarget: string | null = null;
    let witchSaved = false;
    let witchPoisonTarget: string | null = null;
    let enchantTarget: string | null = null;

    for (const phase of mode.nightPhaseOrder) {
      const nightPlayers = roundPlayers;

      // Judge: "XXX请睁眼"
      const wakeMsg = await narrateRoleWake(phase);
      await addSystemMessage(gameId, round, phase as Phase, wakeMsg);
      await delay(TIMING.PHASE_TRANSITION);

      switch (phase) {
        case "night_cupid":
          if (!abilitiesStripped) {
            await runCupidNight(gameId, round, nightPlayers);
          }
          break;
        case "night_guard":
          if (!abilitiesStripped) {
            guardTarget = await runGuardNight(gameId, round, nightPlayers);
          }
          break;
        case "night_werewolf":
          wolfTarget = await runWerewolfNight(gameId, round, nightPlayers);
          break;
        case "night_witch":
          if (!abilitiesStripped) {
            const wr = await runWitchNight(gameId, round, nightPlayers, wolfTarget);
            witchSaved = wr.saved;
            witchPoisonTarget = wr.poisonTarget;
          }
          break;
        case "night_enchant":
          enchantTarget = await runEnchantNight(gameId, round, nightPlayers);
          break;
        case "night_seer":
          if (!abilitiesStripped) {
            // If seer is enchanted, run the phase but result is randomized
            if (enchantTarget) {
              const seer = nightPlayers.find((p) => p.isAlive && p.role === "seer");
              if (seer && enchantTarget === seer.id) {
                log.info(`Seer ${seer.agentName} is enchanted — check result randomized.`);
                // Still run agent turn so seer "thinks" they acted, but we don't record a real result
                await runSeerNight(gameId, round, nightPlayers, true);
                break;
              }
            }
            await runSeerNight(gameId, round, nightPlayers);
          }
          break;
        case "night_dreamweaver":
          if (!abilitiesStripped) {
            await runDreamweaverNight(gameId, round, nightPlayers, enchantTarget);
          }
          break;
      }

      // Judge: "XXX请闭眼"
      const sleepMsg = await narrateRoleSleep(phase);
      await addSystemMessage(gameId, round, phase as Phase, sleepMsg);
      await delay(TIMING.PHASE_TRANSITION);
    }

    // Resolve night (refresh in case of any DB-level changes)
    roundPlayers = await getAllPlayers(gameId);
    const preResolvePlayers = roundPlayers;
    const { deaths: nightDeaths, elderUsedThisRound } = resolveNightActions(
      wolfTarget,
      guardTarget,
      witchSaved,
      witchPoisonTarget,
      preResolvePlayers,
      elderExtraLifeUsed,
      enchantTarget
    );
    // Persist elder extra life usage so it survives hot-reload/crash recovery
    if (elderUsedThisRound && wolfTarget) {
      elderExtraLifeUsed = true;
      const elderP = preResolvePlayers.find((p) => p.id === wolfTarget);
      if (elderP) {
        await db.insert(actions).values({
          gameId,
          round,
          playerId: elderP.id,
          actionType: "elder_extra_life",
          targetId: elderP.id,
          result: "used",
        });
      }
    }

    // ── DAY: Announce ──
    const deathInfos = nightDeaths.map((d) => ({
      name: preResolvePlayers.find((p) => p.id === d.playerId)?.agentName ?? "?",
      cause: d.cause,
    }));
    const dayNarration = await narrateDayBreak(round, deathInfos);
    emit({
      type: "day_break",
      gameId,
      round,
      timestamp: new Date().toISOString(),
      data: { description: dayNarration },
    });
    await delay(TIMING.PHASE_TRANSITION);
    await updatePhase(gameId, "day_announce");

    // Elder survived announcement
    if (elderUsedThisRound && wolfTarget) {
      const elder = preResolvePlayers.find((p) => p.id === wolfTarget);
      if (elder) {
        await addSystemMessage(
          gameId,
          round,
          "day_announce",
          `🛡️ ${elder.agentName} 被袭击但奇迹般地活了下来！`
        );
      }
    }

    if (nightDeaths.length === 0 && !elderUsedThisRound) {
      await addSystemMessage(gameId, round, "day_announce", dayNarration);
    } else {
      // Announce day break narration first
      await addSystemMessage(gameId, round, "day_announce", dayNarration);
      for (const death of nightDeaths) {
        const victim = preResolvePlayers.find((p) => p.id === death.playerId);
        await killPlayer(gameId, death.playerId, round);
        await delay(TIMING.DEATH_ANNOUNCEMENT);

        // Death triggers
        if (victim) {
          await handleDeathTrigger(gameId, round, victim, death.cause, abilitiesStripped);
        }

        // Couple heartbreak
        await handleCoupleHeartbreak(gameId, round, death.playerId, abilitiesStripped);
      }
    }

    // Check win after night
    const postNightPlayers = await getAllPlayers(gameId);
    const nightWin = checkWinCondition(postNightPlayers);
    if (nightWin.finished) {
      await endGame(gameId, nightWin.winner, nightWin.reason, round);
      return;
    }

    // ── DAY: First Speech Round (seat order starting from victim's next seat) ──
    await updatePhase(gameId, "day_discuss");
    const dayPlayers = await getAllPlayers(gameId);
    const aliveDayPlayers = dayPlayers.filter((p) => p.isAlive);

    // Determine speech order: start from the seat AFTER the first victim
    const firstVictimSeat = nightDeaths.length > 0
      ? preResolvePlayers.find((p) => p.id === nightDeaths[0].playerId)?.seatNumber ?? 0
      : 0;
    const sortedSpeakerIds = [...aliveDayPlayers]
      .sort((a, b) => {
      // Rotate so that seats after the victim come first
      const offsetA = (a.seatNumber - firstVictimSeat - 1 + dayPlayers.length) % dayPlayers.length;
      const offsetB = (b.seatNumber - firstVictimSeat - 1 + dayPlayers.length) % dayPlayers.length;
      return offsetA - offsetB;
      })
      .map((p) => p.id);

    // Track if knight uses ability this round (game breaks out of speech loop)
    let knightFlippedThisRound = false;

    for (const speakerId of sortedSpeakerIds) {
      if (knightFlippedThisRound) break;

      const currentPlayers = await getAllPlayers(gameId);
      const player = currentPlayers.find((p) => p.id === speakerId);
      if (!player || !player.isAlive) continue;

      // Judge introduces speaker
      const introMsg = await narrateSpeakerIntro(player.agentName, player.seatNumber);
      await addSystemMessage(gameId, round, "day_discuss", introMsg);

      emit({
        type: "thinking",
        gameId,
        round,
        timestamp: new Date().toISOString(),
        data: { playerId: player.id, playerName: player.agentName },
      });
      await delay(TIMING.BEFORE_SPEAK);

      // Knight can choose to flip a card instead of speaking
      const isKnightWithAbility = player.role === "knight"
        && !abilitiesStripped
        && !(await hasKnightUsedCheck(gameId));

      const result = await runAgentTurn({
        gameId,
        player,
        allPlayers: currentPlayers,
        phase: "day_discuss",
        round,
        actionType: isKnightWithAbility ? "knight_speak" : "speak",
      });

      // Handle knight card flip
      if (isKnightWithAbility && result.knightCheck && result.targetId) {
        const target = currentPlayers.find((p) => p.id === result.targetId);
        const targetRole = target?.role as Role | undefined;
        const targetIsWolf = targetRole ? isWerewolfTeam(targetRole) && targetRole !== "madman" : false;

        await db.insert(actions).values({
          gameId,
          round,
          playerId: player.id,
          actionType: "knight_check",
          targetId: result.targetId,
          result: targetIsWolf ? "wolf_found" : "not_wolf",
        });

        if (targetIsWolf) {
          // Knight succeeds: target wolf dies
          await killPlayer(gameId, result.targetId, round);
          await addSystemMessage(
            gameId,
            round,
            "day_discuss",
            `⚔️ 骑士 ${player.agentName} 亮出身份翻验 ${target?.agentName}，是狼人！${target?.agentName} 被立即淘汰！`
          );
          emit({
            type: "knight_check",
            gameId,
            round,
            timestamp: new Date().toISOString(),
            data: {
              knightId: player.id,
              knightName: player.agentName,
              targetId: result.targetId,
              targetName: target?.agentName,
              result: "wolf_found",
            },
          });
          await delay(TIMING.DEATH_ANNOUNCEMENT);

          // Trigger death effects on the eliminated wolf
          if (target) {
            await handleDeathTrigger(gameId, round, target, "knight_check", abilitiesStripped);
          }
          await handleCoupleHeartbreak(gameId, round, result.targetId, abilitiesStripped);
        } else {
          // Knight fails: knight dies
          await killPlayer(gameId, player.id, round);
          await addSystemMessage(
            gameId,
            round,
            "day_discuss",
            `⚔️ 骑士 ${player.agentName} 亮出身份翻验 ${target?.agentName}，不是狼人！骑士付出了生命的代价！`
          );
          emit({
            type: "knight_check",
            gameId,
            round,
            timestamp: new Date().toISOString(),
            data: {
              knightId: player.id,
              knightName: player.agentName,
              targetId: result.targetId,
              targetName: target?.agentName,
              result: "not_wolf",
            },
          });
          await delay(TIMING.DEATH_ANNOUNCEMENT);
          await handleCoupleHeartbreak(gameId, round, player.id, abilitiesStripped);
        }

        knightFlippedThisRound = true;

        // Check win after knight flip
        const postKnightPlayers = await getAllPlayers(gameId);
        const knightWin = checkWinCondition(postKnightPlayers);
        if (knightWin.finished) {
          await endGame(gameId, knightWin.winner, knightWin.reason, round);
          return;
        }
      } else if (result.message) {
        await db.insert(messages).values({ gameId, round, phase: "day_discuss", playerId: player.id, content: result.message });
        emit({
          type: "message",
          gameId,
          round,
          timestamp: new Date().toISOString(),
          data: { playerId: player.id, playerName: player.agentName, content: result.message, isPrivate: false },
        });
        await delay(TIMING.AFTER_SPEAK);
      }
    }

    // ── DAY: Free Discussion (Rebuttal) ──
    const discussionMsg = await narrateDiscussionStart();
    await addSystemMessage(gameId, round, "day_discuss", discussionMsg);
    for (const speakerId of sortedSpeakerIds) {
      const currentPlayers = await getAllPlayers(gameId);
      const player = currentPlayers.find((p) => p.id === speakerId);
      if (!player || !player.isAlive) continue;

      emit({
        type: "thinking",
        gameId,
        round,
        timestamp: new Date().toISOString(),
        data: { playerId: player.id, playerName: player.agentName },
      });
      await delay(TIMING.BEFORE_SPEAK);

      const result = await runAgentTurn({
        gameId,
        player,
        allPlayers: currentPlayers,
        phase: "day_discuss",
        round,
        actionType: "speak_rebuttal",
      });
      if (result.message) {
        await db.insert(messages).values({ gameId, round, phase: "day_discuss", playerId: player.id, content: result.message });
        emit({
          type: "message",
          gameId,
          round,
          timestamp: new Date().toISOString(),
          data: { playerId: player.id, playerName: player.agentName, content: result.message, isPrivate: false },
        });
        await delay(TIMING.AFTER_SPEAK);
      }
    }

    // ── DAY: Vote ──
    const voteStartMsg = await narrateVoteStart();
    await addSystemMessage(gameId, round, "day_discuss", voteStartMsg);
    await delay(TIMING.BEFORE_VOTE);
    await updatePhase(gameId, "day_vote");
    const dayVotes: { voterId: string; targetId: string }[] = [];
    const preVotePlayers = await getAllPlayers(gameId);
    const aliveVoters = preVotePlayers.filter((p) => p.isAlive);

    // Revealed idiot loses voting rights
    const idiotRevealed = await hasIdiotRevealed(gameId);
    const idiotPlayer = aliveVoters.find((p) => p.role === "idiot");
    const votingPlayers = idiotRevealed && idiotPlayer
      ? aliveVoters.filter((p) => p.id !== idiotPlayer.id)
      : aliveVoters;

    for (const player of votingPlayers) {
      const result = await runAgentTurn({
        gameId,
        player,
        allPlayers: preVotePlayers,
        phase: "day_vote",
        round,
        actionType: "vote",
      });
      if (result.targetId) {
        dayVotes.push({ voterId: player.id, targetId: result.targetId });
        await db.insert(votes).values({ gameId, round, voterId: player.id, targetId: result.targetId, phase: "day_vote" });
        emit({
          type: "vote",
          gameId,
          round,
          timestamp: new Date().toISOString(),
          data: {
            voterId: player.id,
            voterName: player.agentName,
            targetId: result.targetId,
            targetName: preVotePlayers.find((p) => p.id === result.targetId)?.agentName,
            reason: result.reason,
          },
        });
        await delay(TIMING.VOTE_REVEAL_INTERVAL);
      }
    }

    // Vote tally
    const tally: Record<string, string[]> = {};
    for (const v of dayVotes) {
      if (!tally[v.targetId]) tally[v.targetId] = [];
      const voter = preVotePlayers.find((p) => p.id === v.voterId);
      tally[v.targetId].push(voter?.agentName ?? "?");
    }
    emit({
      type: "vote_tally",
      gameId,
      round,
      timestamp: new Date().toISOString(),
      data: {
        tally: Object.entries(tally).map(([targetId, voters]) => ({
          targetId,
          targetName: preVotePlayers.find((p) => p.id === targetId)?.agentName,
          count: voters.length,
          voters,
        })),
      },
    });

    const eliminated = resolveVote(dayVotes);
    const voteTally = Object.entries(tally).map(([targetId, voters]) => ({
      name: preVotePlayers.find((p) => p.id === targetId)?.agentName ?? "?",
      votes: voters.length,
    }));
    if (eliminated) {
      const victim = preVotePlayers.find((p) => p.id === eliminated);
      const victimRole = victim?.role as Role | undefined;

      // Idiot first-time vote immunity: reveal identity, survive, lose vote rights
      if (victimRole === "idiot" && !(await hasIdiotRevealed(gameId))) {
        await db.insert(actions).values({
          gameId,
          round,
          playerId: eliminated,
          actionType: "idiot_reveal",
          targetId: eliminated,
          result: "revealed",
        });
        await addSystemMessage(
          gameId,
          round,
          "day_vote",
          `🃏 ${victim?.agentName} 被投票淘汰，但翻牌亮出【白痴】身份，免于一死！从此失去投票权。`
        );
        emit({
          type: "idiot_reveal",
          gameId,
          round,
          timestamp: new Date().toISOString(),
          data: { playerId: eliminated, playerName: victim?.agentName },
        });
        await delay(TIMING.DEATH_ANNOUNCEMENT);
      } else {
        // Normal elimination
        await killPlayer(gameId, eliminated, round);
        const voteNarration = await narrateVoteResult(
          { name: victim?.agentName ?? "?", roleZh: ROLE_CONFIGS[victimRole ?? "villager"].nameZh },
          voteTally
        );
        await addSystemMessage(gameId, round, "day_vote", voteNarration);
        await delay(TIMING.DEATH_ANNOUNCEMENT);

        // Elder voted out → strip abilities
        if (victimRole === "elder") {
          abilitiesStripped = true;
          await addSystemMessage(gameId, round, "day_vote", "⚠️ 长老被投票淘汰！作为惩罚，所有好人阵营失去特殊技能。");
        }

        // Death triggers
        if (victim) {
          await handleDeathTrigger(gameId, round, victim, "vote", abilitiesStripped);
        }

        // Couple heartbreak
        await handleCoupleHeartbreak(gameId, round, eliminated, abilitiesStripped);

        // Last words
        if (victim) {
          const lwIntro = await narrateLastWordsIntro(victim.agentName);
          await addSystemMessage(gameId, round, "day_vote", lwIntro);

          emit({
            type: "thinking",
            gameId,
            round,
            timestamp: new Date().toISOString(),
            data: { playerId: victim.id, playerName: victim.agentName },
          });
          await delay(TIMING.BEFORE_SPEAK);

          const currentPlayersForLastWords = await getAllPlayers(gameId);
          const victimForLastWords =
            currentPlayersForLastWords.find((p) => p.id === victim.id) ?? victim;
          const lw = await runAgentTurn({
            gameId,
            player: victimForLastWords,
            allPlayers: currentPlayersForLastWords,
            phase: "day_vote",
            round,
            actionType: "last_words",
          });
          if (lw.message) {
            await db.insert(messages).values({ gameId, round, phase: "day_vote", playerId: victim.id, content: lw.message });
            emit({
              type: "last_words",
              gameId,
              round,
              timestamp: new Date().toISOString(),
              data: { playerId: victim.id, playerName: victim.agentName, content: lw.message },
            });
            await delay(TIMING.LAST_WORDS);
          }
        }
      } // end normal elimination
    } else {
      const tieNarration = await narrateVoteResult(null, voteTally);
      await addSystemMessage(gameId, round, "day_vote", tieNarration);
    }

    // Check win after vote
    const postVotePlayers = await getAllPlayers(gameId);
    const dayWin = checkWinCondition(postVotePlayers);
    if (dayWin.finished) {
      await endGame(gameId, dayWin.winner, dayWin.reason, round);
      return;
    }

    // ── Next round ──
    round++;
    if (round > MAX_ROUNDS) {
      await endGame(gameId, "villager", `已达最大回合数(${MAX_ROUNDS})，狼人未能取胜，好人阵营判定胜利！`, round - 1);
      return;
    }
    const nextNightNarration = await narrateNightFall(
      round,
      (await getAllPlayers(gameId)).filter((p) => p.isAlive).length
    );
    await addSystemMessage(
      gameId,
      round,
      mode.nightPhaseOrder[0] as Phase,
      nextNightNarration
    );
  }
}

// ─── Game End ───────────────────────────────────────────────────

async function endGame(
  gameId: string,
  winner: "werewolf" | "villager" | "draw",
  reason: string,
  round: number
) {
  await db
    .update(games)
    .set({ status: "finished", currentPhase: "game_over", winner, finishedAt: new Date() })
    .where(eq(games.id, gameId));

  const allPlayers = await getAllPlayers(gameId);
  emit({
    type: "role_reveal",
    gameId,
    round,
    timestamp: new Date().toISOString(),
    data: {
      players: allPlayers.map((p) => ({
        id: p.id,
        name: p.agentName,
        role: p.role,
        roleZh: ROLE_CONFIGS[(p.role as Role) ?? "villager"].nameZh,
        alive: p.isAlive,
      })),
    },
  });

  const endNarration = await narrateGameOver(winner, reason, round);
  await addSystemMessage(gameId, round, "game_over", endNarration);

  emit({
    type: "game_over",
    gameId,
    round,
    timestamp: new Date().toISOString(),
    data: { winner, reason },
  });

  // Update agent stats and set cooldown
  await onGameEnd(gameId, winner, allPlayers).catch((e) => log.error("onGameEnd failed:", e));

  // Clean up game state
  clearGameEvents(gameId);

  await delay(TIMING.GAME_OVER);
}

// ─── Crash Recovery ─────────────────────────────────────────────

async function recoverCrashedGame(gameId: string): Promise<void> {
  try {
    const [game] = await db.select().from(games).where(eq(games.id, gameId));
    if (!game || game.status === "finished") return;

    log.info(`Recovering crashed game ${gameId}...`);

    await db
      .update(games)
      .set({ status: "finished", currentPhase: "game_over", winner: "draw", finishedAt: new Date() })
      .where(eq(games.id, gameId));

    const allPlayers = await getAllPlayers(gameId);
    await addSystemMessage(gameId, game.currentRound, "game_over", "⚠️ 游戏因系统异常终止（不计分）。");

    emit({
      type: "game_over",
      gameId,
      round: game.currentRound,
      timestamp: new Date().toISOString(),
      data: { winner: "draw", reason: "游戏异常终止" },
    });

    // Release agents from playing status — draw skips ELO
    await onGameEnd(gameId, "draw", allPlayers).catch((e) => log.error("Recovery onGameEnd failed:", e));

    log.info(`Game ${gameId} recovered. Agents released.`);
  } catch (err) {
    log.error(`Failed to recover game ${gameId}:`, err);
  }
}
