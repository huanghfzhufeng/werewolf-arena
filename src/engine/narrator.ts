import { getNarratorSkill } from "@/skills";
import { chatCompletion } from "@/agents/llm-client";
import { createLogger } from "@/lib";

const log = createLogger("Narrator");

/**
 * Generate narration via LLM using the judge narrator skill.
 * Falls back to the provided fallback text on any error.
 */
async function narrate(
  phase: string,
  context: string,
  fallback: string
): Promise<string> {
  const skill = getNarratorSkill("judge");
  if (!skill) return fallback;

  try {
    const result = await chatCompletion(
      [
        { role: "system", content: skill.body },
        {
          role: "user",
          content: `## 叙述阶段: ${phase}\n${context}\n\n请用2-4句中文生成叙述。不要透露任何角色身份。`,
        },
      ],
      { temperature: 0.9, maxTokens: 150 }
    );
    return result || fallback;
  } catch (err) {
    log.warn(`Narration failed for ${phase}, using fallback:`, err);
    return fallback;
  }
}

// ─── Public narration functions ─────────────────────────────────

export async function narrateGameStart(
  modeName: string,
  playerCount: number,
  playerNames: string[]
): Promise<string> {
  const fallback = `🌙 ${modeName} 开始！天黑请闭眼。第 1 夜开始。`;
  return narrate(
    "game_start",
    `游戏模式: ${modeName}\n参与人数: ${playerCount}\n玩家: ${playerNames.join("、")}`,
    fallback
  );
}

export async function narrateNightFall(
  round: number,
  aliveCount: number
): Promise<string> {
  const fallback =
    round === 1
      ? "月光洒落在寂静的村庄，黑影悄然移动……"
      : `🌙 天黑请闭眼。第 ${round} 夜开始。`;
  return narrate(
    "night_fall",
    `第 ${round} 夜降临。当前存活 ${aliveCount} 人。`,
    fallback
  );
}

export async function narrateDayBreak(
  round: number,
  deaths: { name: string; cause: string }[]
): Promise<string> {
  if (deaths.length === 0) {
    const fallback = "☀️ 天亮了。昨晚是平安夜，无人被淘汰。";
    return narrate(
      "day_break",
      `第 ${round} 天破晓。昨晚是平安夜，所有人都安全。`,
      fallback
    );
  }

  const deathDesc = deaths
    .map((d) => {
      if (d.cause === "wolf_kill") return `${d.name} 在夜间被不明力量袭击`;
      if (d.cause === "witch_poison") return `${d.name} 在夜间中毒`;
      return `${d.name} 在夜间死亡`;
    })
    .join("；");

  const fallback =
    deaths.length === 1 && deaths[0].cause === "wolf_kill"
      ? `☀️ 天亮了。昨晚 ${deaths[0].name} 被狼人淘汰了。`
      : `☀️ 天亮了。${deathDesc}。`;

  return narrate(
    "day_break",
    `第 ${round} 天破晓。昨晚的遇难者: ${deathDesc}。`,
    fallback
  );
}

export async function narrateDeathAnnounce(
  victimName: string,
  cause: string
): Promise<string> {
  const causeMap: Record<string, string> = {
    wolf_kill: "被狼人袭击",
    witch_poison: "中毒身亡",
    hunter_shoot: "被猎人射杀",
    wolf_king_revenge: "被狼王带走",
    white_wolf_explode: "被白狼王自爆带走",
    couple_heartbreak: "因情侣殉情而死",
    vote: "被投票淘汰",
  };
  const causeZh = causeMap[cause] ?? "死亡";
  const fallback =
    cause === "wolf_kill"
      ? `☀️ 天亮了。昨晚 ${victimName} 被狼人淘汰了。`
      : cause === "witch_poison"
        ? `☠️ ${victimName} 在夜间中毒身亡。`
        : `💀 ${victimName} ${causeZh}。`;

  return narrate(
    "death_announce",
    `${victimName} ${causeZh}。请用叙事方式宣布这个消息。`,
    fallback
  );
}

export async function narrateVoteResult(
  eliminated: { name: string; roleZh: string } | null,
  tally: { name: string; votes: number }[]
): Promise<string> {
  if (!eliminated) {
    const fallback = "🗳️ 投票结束。平票，无人被淘汰。";
    return narrate(
      "vote_result",
      `投票结束，出现平票，无人被淘汰。投票情况: ${tally.map((t) => `${t.name}(${t.votes}票)`).join("、")}`,
      fallback
    );
  }

  const fallback = `🗳️ 投票结束。${eliminated.name} 被投票淘汰。身份是：${eliminated.roleZh}。`;
  return narrate(
    "vote_result",
    `投票结束，${eliminated.name} 以最高票被淘汰。投票情况: ${tally.map((t) => `${t.name}(${t.votes}票)`).join("、")}。注意：不要透露淘汰者的身份。`,
    fallback
  );
}

export async function narrateGameOver(
  winner: "werewolf" | "villager",
  reason: string,
  round: number
): Promise<string> {
  const winnerZh = winner === "werewolf" ? "狼人阵营" : "好人阵营";
  const fallback = `🎮 游戏结束！${reason}`;
  return narrate(
    "game_over",
    `游戏在第 ${round} 轮结束。${winnerZh}获胜。原因: ${reason}`,
    fallback
  );
}

// ─── Night sub-phase narration ─────────────────────────

/** Map night phase id to Chinese role name */
const PHASE_ROLE_ZH: Record<string, string> = {
  night_cupid: "丘比特",
  night_guard: "守卫",
  night_werewolf: "狼人",
  night_witch: "女巫",
  night_seer: "预言家",
};

export async function narrateRoleWake(phaseId: string): Promise<string> {
  const roleZh = PHASE_ROLE_ZH[phaseId] ?? phaseId;
  const fallback = `🌙 ${roleZh}请睁眼。`;
  return narrate(
    "role_wake",
    `现在是${roleZh}的回合。请用一句话宣布"${roleZh}请睁眼"，可以加一点氛围描写。`,
    fallback
  );
}

export async function narrateRoleSleep(phaseId: string): Promise<string> {
  const roleZh = PHASE_ROLE_ZH[phaseId] ?? phaseId;
  const fallback = `🌙 ${roleZh}请闭眼。`;
  return narrate(
    "role_sleep",
    `${roleZh}已完成行动。请用一句话宣布"${roleZh}请闭眼"。`,
    fallback
  );
}

// ─── Daytime hosting narration ─────────────────────────

export async function narrateSpeakerIntro(
  playerName: string,
  seatNumber: number
): Promise<string> {
  const fallback = `🗣️ 请 ${seatNumber}号 ${playerName} 发言。`;
  return narrate(
    "speaker_intro",
    `现在轮到 ${seatNumber}号座位的 ${playerName} 发言。请用一句话简短地介绍。`,
    fallback
  );
}

export async function narrateDiscussionStart(): Promise<string> {
  const fallback = "🔄 第一轮发言结束，进入自由讨论环节。请各位针对刚才的发言进行质疑或补充。";
  return narrate(
    "discussion_start",
    "第一轮发言已经结束，现在进入自由讨论环节。请宣布进入讨论环节。",
    fallback
  );
}

export async function narrateVoteStart(): Promise<string> {
  const fallback = "🗳️ 讨论结束，请各位投票。3、2、1，亮票！";
  return narrate(
    "vote_start",
    "讨论结束，现在进入投票环节。请用有仪式感的方式宣布投票开始。",
    fallback
  );
}

export async function narrateLastWordsIntro(playerName: string): Promise<string> {
  const fallback = `💬 请 ${playerName} 发表遗言。`;
  return narrate(
    "last_words_intro",
    `${playerName} 被淘汰了。请宣布让其发表遗言。`,
    fallback
  );
}
