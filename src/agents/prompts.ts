import type { Player, Message } from "@/db/schema";
import { ROLE_CONFIGS, isWerewolfTeam } from "@/engine/roles";
import type { Role } from "@/engine/roles";
import type { Phase } from "@/engine/state-machine";
import { getActionSkill } from "@/skills";
import { searchMemories } from "@/memory";
import { createLogger } from "@/lib";

const log = createLogger("Prompts");

type PromptContext = {
  player: Player;
  allPlayers: Player[];
  phase: Phase;
  round: number;
  actionType: string;
  chatHistory: Message[];
  knownInfo: string[];
  extraContext?: Record<string, unknown>;
};

/** Read the markdown body of an action skill, or return a fallback. */
function actionBody(name: string, fallback = "Take your action."): string {
  return getActionSkill(name)?.body ?? fallback;
}

export async function buildSystemPrompt(ctx: PromptContext): Promise<string> {
  const role = (ctx.player.role ?? "villager") as Role;
  const roleConfig = ROLE_CONFIGS[role];
  const alivePlayers = ctx.allPlayers.filter((p) => p.isAlive);
  const deadPlayers = ctx.allPlayers.filter((p) => !p.isAlive);

  // Wolf team awareness
  let teamInfo = "";
  if (isWerewolfTeam(role) && role !== "madman") {
    const partners = ctx.allPlayers.filter(
      (p) => p.id !== ctx.player.id && p.role && isWerewolfTeam(p.role as Role) && p.role !== "madman"
    );
    if (partners.length > 0) {
      teamInfo = `Your werewolf teammates: ${partners.map((p) => {
        const alive = p.isAlive ? "alive" : "dead";
        return `${p.agentName}(seat ${p.seatNumber}, ${ROLE_CONFIGS[(p.role as Role)].nameZh}, ${alive})`;
      }).join(", ")}.`;
    } else {
      teamInfo = "You are the last surviving wolf.";
    }
  } else if (role === "madman") {
    teamInfo = "You are on the werewolf team but you do NOT know who the werewolves are. They don't know you either. Act as a villager to create chaos.";
  }

  const knownSection =
    ctx.knownInfo.length > 0
      ? `\n## Known Information\n${ctx.knownInfo.map((info) => `- ${info}`).join("\n")}`
      : "";

  // Build personality block from jsonb column
  const p = ctx.player.personality;
  const personalityBlock = p?.character
    ? `Character: ${p.character} (from ${p.series})
Catchphrase: "${p.catchphrase}"
Personality: ${p.trait}
Speaking Style: ${p.speakingStyle}

You MUST stay in character as ${p.character} at all times. Your speech should reflect this character's unique personality and occasionally use your catchphrase naturally.`
    : JSON.stringify(ctx.player.personality);

  // Build role list for game rules
  const roleDistribution: Record<string, number> = {};
  for (const p of ctx.allPlayers) {
    const r = (p.role ?? "villager") as Role;
    const rName = ROLE_CONFIGS[r].nameZh;
    roleDistribution[rName] = (roleDistribution[rName] ?? 0) + 1;
  }
  const roleListStr = Object.entries(roleDistribution)
    .map(([name, count]) => `${count}${name}`)
    .join(", ");

  // Memory injection — dynamic multi-source search (OpenClaw-aligned)
  let memorySection = "";
  if (ctx.player.agentId) {
    try {
      // Build targeted search queries for diverse recall
      const opponents = ctx.allPlayers.filter((p) => p.id !== ctx.player.id);
      const searchQueries = [
        roleConfig.nameZh, // role-specific strategy
        ...opponents.slice(0, 3).map((p) => p.agentName), // opponent impressions
      ];

      // Search with each query, deduplicate by id
      const seen = new Set<string>();
      const allMemories: Awaited<ReturnType<typeof searchMemories>> = [];
      for (const q of searchQueries) {
        if (allMemories.length >= 5) break;
        const results = await searchMemories(ctx.player.agentId, q, { limit: 3 });
        for (const m of results) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            allMemories.push(m);
          }
        }
      }

      const memories = allMemories.slice(0, 5);
      if (memories.length > 0) {
        const SOURCE_LABEL: Record<string, string> = {
          "self-note": "自省",
          social: "印象",
          reflection: "反思",
          "game-transcript": "记录",
        };
        memorySection = `\n## Past Experience\n${memories.map((m) => `- [${SOURCE_LABEL[m.source] ?? m.source}] ${m.content}`).join("\n")}`;
      }
    } catch (err) {
      log.warn("Failed to load memories for prompt:", err);
    }
  }

  // roleConfig.description is already loaded from ROLE.md skill body
  return `# Werewolf Game — Agent Identity
You are "${ctx.player.agentName}", sitting at seat ${ctx.player.seatNumber}.

## Character Identity
${personalityBlock}

## Your Role: ${roleConfig.nameZh} (${roleConfig.name})
${roleConfig.description}
${teamInfo}

## Game Rules
- ${ctx.allPlayers.length} players: ${roleListStr}
- Night: werewolves choose a victim; special roles act in order.
- Day: everyone discusses, then votes to eliminate one player. Highest votes = eliminated. Tie = no elimination.
- Werewolves win when wolf count ≥ villager count. Villagers win when all wolves are dead.

## Current State
- Round: ${ctx.round}
- Phase: ${ctx.phase}
- Alive players: ${alivePlayers.map((p) => `${p.agentName}(seat ${p.seatNumber})`).join(", ")}
- Dead players: ${deadPlayers.length > 0 ? deadPlayers.map((p) => p.agentName).join(", ") : "none"}
${knownSection}${memorySection}

## Important
- Stay in character as your anime character at all times.
- NEVER reveal your game role directly unless strategically wise (e.g., seer claiming).
- Keep responses concise: 2-4 sentences for speech, just a name for votes/targets.
- Respond in Chinese (中文).`;
}

// ─── Dynamic context builders ───────────────────────────────────

function chatHistoryBlock(ctx: PromptContext): string {
  const historyText =
    ctx.chatHistory.length > 0
      ? ctx.chatHistory
          .map((m) => {
            const speaker = m.isSystem
              ? "【系统】"
              : ctx.allPlayers.find((p) => p.id === m.playerId)?.agentName ?? "未知";
            return `${speaker}: ${m.content}`;
          })
          .join("\n")
      : "(暂无对话记录)";
  return `## Chat History This Round\n${historyText}`;
}

function targetList(ctx: PromptContext, filter: (p: Player) => boolean): string {
  return ctx.allPlayers
    .filter((p) => p.isAlive && filter(p))
    .map((p) => p.agentName)
    .join(", ");
}

// ─── User prompt ────────────────────────────────────────────────

export function buildUserPrompt(ctx: PromptContext): string {
  const history = chatHistoryBlock(ctx);
  const otherAlive = (p: Player) => p.id !== ctx.player.id;

  switch (ctx.actionType) {
    case "speak":
      return `${history}\n\n${actionBody("speak")}`;

    case "speak_rebuttal":
      return `${history}\n\n${actionBody("speak_rebuttal")}`;

    case "vote":
      return `${history}\n\n${actionBody("vote")}`;

    case "choose_kill_target": {
      const nonWolves = ctx.allPlayers.filter(
        (p) => p.isAlive && p.role && !isWerewolfTeam(p.role as Role)
      );
      return `## Werewolf Night Phase\n${chatHistoryBlock(ctx)}\n\nAvailable targets: ${nonWolves.map((p) => p.agentName).join(", ")}\n\n${actionBody("choose_kill_target")}`;
    }

    case "seer_check":
      return `## Seer Night Phase\nAvailable targets: ${targetList(ctx, otherAlive)}\n\n${actionBody("seer_check")}`;

    case "witch_decide": {
      const extra = ctx.extraContext ?? {};
      const wolfVictimName = extra.wolfVictimName as string | null;
      const hasSave = extra.hasSavePotion as boolean;
      const hasPoison = extra.hasPoisonPotion as boolean;

      let info = "## Witch Night Phase\n";
      if (wolfVictimName) {
        info += `Tonight the werewolves attacked: **${wolfVictimName}**\n`;
      } else {
        info += "Tonight the werewolves did not kill anyone.\n";
      }
      info += `\nYour potions:\n`;
      info += `- Save potion (解药): ${hasSave ? "✅ Available" : "❌ Already used"}\n`;
      info += `- Poison potion (毒药): ${hasPoison ? "✅ Available" : "❌ Already used"}\n`;
      info += `\nChoose ONE action:\n`;
      if (hasSave && wolfVictimName) {
        info += `- SAVE: Use your antidote to rescue ${wolfVictimName}\n`;
      }
      if (hasPoison) {
        info += `- POISON: Kill any alive player with your poison\n`;
        info += `  Available poison targets: ${targetList(ctx, otherAlive)}\n`;
      }
      info += `- NONE: Do nothing and save your potions\n`;
      info += `\nRespond in this EXACT format:\nACTION: save|poison|none\nTARGET: <player name if poisoning, otherwise leave empty>`;
      return info;
    }

    case "guard_protect": {
      const lastProtectedId = ctx.extraContext?.lastProtectedId as string | null;
      const lastProtectedName = lastProtectedId
        ? ctx.allPlayers.find((p) => p.id === lastProtectedId)?.agentName
        : null;

      let info = `${actionBody("guard_protect")}\n`;
      if (lastProtectedName) {
        info += `\n⚠️ You protected **${lastProtectedName}** last night. You CANNOT protect them again tonight.`;
      }
      const eligible = ctx.allPlayers.filter(
        (p) => p.isAlive && p.id !== lastProtectedId
      );
      info += `\nAvailable targets: ${eligible.map((p) => p.agentName).join(", ")}`;
      return info;
    }

    case "hunter_shoot":
      return `${actionBody("hunter_shoot")}\nAvailable targets: ${targetList(ctx, otherAlive)}`;

    case "wolf_king_revenge":
      return `${actionBody("wolf_king_revenge")}\nAvailable targets: ${targetList(ctx, otherAlive)}`;

    case "cupid_link":
      return `${actionBody("cupid_link")}\n\nAvailable players: ${targetList(ctx, otherAlive)}`;

    case "knight_speak":
      return `${history}\n\n${actionBody("knight_speak")}\n\nAvailable flip targets: ${targetList(ctx, otherAlive)}`;

    case "enchant_target": {
      const nonWolves = ctx.allPlayers.filter(
        (p) => p.isAlive && p.role && !isWerewolfTeam(p.role as Role)
      );
      return `## Enchantress Night Phase\n${actionBody("enchant_target")}\n\nAvailable targets: ${nonWolves.map((p) => p.agentName).join(", ")}`;
    }

    case "dreamweaver_check": {
      const lastPairKey = ctx.extraContext?.lastDreamweaverPairKey as string | null;
      let info = `${actionBody("dreamweaver_check")}\n\nAvailable targets: ${targetList(ctx, otherAlive)}`;
      if (lastPairKey) {
        const [id1, id2] = lastPairKey.split(":");
        const name1 = ctx.allPlayers.find((p) => p.id === id1)?.agentName ?? "?";
        const name2 = ctx.allPlayers.find((p) => p.id === id2)?.agentName ?? "?";
        info += `\n\n⚠️ Last night you checked: ${name1} and ${name2}. You CANNOT choose the same pair again.`;
      }
      return info;
    }

    case "last_words":
      return actionBody("last_words");

    default:
      return actionBody(ctx.actionType);
  }
}
