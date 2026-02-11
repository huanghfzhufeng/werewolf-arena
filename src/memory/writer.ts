import { db } from "@/db";
import { agentMemories, agentPosts } from "@/db/schema";
import type { Player } from "@/db/schema";
import { ROLE_CONFIGS } from "@/engine/roles";
import type { Role } from "@/engine/roles";
import { chatCompletion } from "@/agents/llm-client";
import { emitCommunity } from "@/community/community-events";
import { loadConfig } from "@/config";
import { createLogger } from "@/lib";
import { eq, asc } from "drizzle-orm";
import type { MemoryEntry, AgentMemoryNote } from "./types";
import { generateEmbedding } from "./embeddings";

const log = createLogger("Memory");

// ─── Low-level insert ───────────────────────────────────────────

async function insertMemory(entry: MemoryEntry): Promise<void> {
  const embedding = entry.embedding ?? (await generateEmbedding(entry.content));
  await db.insert(agentMemories).values({
    agentId: entry.agentId,
    source: entry.source,
    gameId: entry.gameId ?? null,
    content: entry.content,
    tags: entry.tags,
    importance: entry.importance,
    ...(embedding ? { embedding } : {}),
  });
}

// ─── Agent Self-Write Memory (OpenClaw-aligned) ─────────────────

/**
 * After a game ends, give the agent an open-ended prompt:
 * "What do you want to remember?" — let the LLM (as the agent)
 * decide what's worth remembering in first person.
 * Returns the notes for downstream use (posts, feed, etc.)
 */
export async function writeAgentMemories(
  agentId: string,
  gameId: string,
  player: Player,
  allPlayers: Player[],
  winner: "werewolf" | "villager",
  keyEvents: string[]
): Promise<AgentMemoryNote[]> {
  const role = (player.role ?? "villager") as Role;
  const roleConfig = ROLE_CONFIGS[role];
  const won = roleConfig.team === winner;
  const p = player.personality as { character?: string; catchphrase?: string; trait?: string };

  const opponents = allPlayers
    .filter((op) => op.id !== player.id)
    .map((op) => `${op.agentName}(${ROLE_CONFIGS[(op.role ?? "villager") as Role].nameZh})`)
    .join(", ");

  const prompt = `你是 ${player.agentName}，性格特征：${p.trait ?? "未知"}。
你刚打完一局狼人杀。你的角色：${roleConfig.nameZh}。结果：${won ? "胜利" : "失败"}。
其他玩家：${opponents}
关键事件：
${keyEvents.map((e) => `- ${e}`).join("\n")}

请以第一人称写下你想记住的内容。你可以自由决定记什么——可以是对手分析、策略教训、自我反思、或对某个对手的印象。

要求：返回 JSON 数组，1-4 条笔记，每条格式：
{"content": "记忆内容（中文）", "tags": ["标签1", "标签2"], "importance": 0.5, "source": "类型"}

source 可选值：
- "self-note": 自我反思、策略教训
- "social": 对某个对手的印象（content 里必须提到对手名字）

importance: 0.3(普通) ~ 0.9(非常重要，如惨痛教训)

只返回 JSON 数组，不要其他文字。`;

  try {
    const raw = await chatCompletion(
      [{ role: "user", content: prompt }],
      { temperature: 0.7, maxTokens: 400 }
    );

    // Parse JSON array from LLM response
    const jsonStr = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const notes: AgentMemoryNote[] = JSON.parse(jsonStr);

    if (!Array.isArray(notes) || notes.length === 0) {
      log.warn(`${player.agentName} returned empty memory notes`);
      return [];
    }

    // Write each note
    const validNotes: AgentMemoryNote[] = [];
    for (const note of notes.slice(0, 4)) {
      if (!note.content || note.content.length < 4) continue;
      const source = note.source === "social" ? "social" : "self-note";
      await insertMemory({
        agentId,
        source,
        gameId,
        content: note.content,
        tags: Array.isArray(note.tags) ? note.tags : [],
        importance: Math.max(0.1, Math.min(0.9, note.importance ?? 0.5)),
      });
      validNotes.push({ ...note, source });
    }

    log.info(`${player.agentName} wrote ${validNotes.length} memory notes`);
    return validNotes;
  } catch (err) {
    log.error(`Failed to write agent memories for ${player.agentName}:`, err);
    return [];
  }
}

// ─── Game Transcript (structured summary) ───────────────────────

/**
 * Write a structured summary of key game events for the agent's memory.
 */
export async function writeGameTranscript(
  agentId: string,
  gameId: string,
  player: Player,
  keyEvents: string[],
  winner: "werewolf" | "villager"
): Promise<void> {
  const role = (player.role ?? "villager") as Role;
  const won = ROLE_CONFIGS[role].team === winner;

  const content = [
    `游戏结果: ${won ? "胜利" : "失败"} (${ROLE_CONFIGS[role].nameZh})`,
    ...keyEvents.slice(0, 10),
  ].join("\n");

  await insertMemory({
    agentId,
    source: "game-transcript",
    gameId,
    content,
    tags: [role, won ? "win" : "loss"],
    importance: 0.5,
  });
}

// ─── Social Memory helper ────────────────────────────────────

export async function writeSocialMemory(
  agentId: string,
  content: string,
  tags: string[]
): Promise<void> {
  await insertMemory({
    agentId,
    source: "social",
    content,
    tags,
    importance: 0.3,
  });
}

// ─── Social Posts ───────────────────────────────────────────────

/**
 * Create a social post (reflection/impression/reply) and emit to community feed.
 */
export async function createPost(params: {
  agentId: string;
  type: "reflection" | "impression" | "reply";
  content: string;
  gameId?: string | null;
  parentId?: string | null;
  targetAgentId?: string | null;
}): Promise<string> {
  const [row] = await db.insert(agentPosts).values({
    agentId: params.agentId,
    type: params.type,
    content: params.content,
    gameId: params.gameId ?? null,
    parentId: params.parentId ?? null,
    targetAgentId: params.targetAgentId ?? null,
  }).returning({ id: agentPosts.id });
  return row.id;
}

// ─── Pruning ────────────────────────────────────────────────────

export async function pruneMemories(agentId: string): Promise<void> {
  const cfg = loadConfig().memory;
  const all = await db
    .select({ id: agentMemories.id })
    .from(agentMemories)
    .where(eq(agentMemories.agentId, agentId))
    .orderBy(asc(agentMemories.importance), asc(agentMemories.createdAt));

  if (all.length <= cfg.maxMemoriesPerAgent) return;

  const toDelete = all.slice(0, all.length - cfg.maxMemoriesPerAgent);
  for (const row of toDelete) {
    await db.delete(agentMemories).where(eq(agentMemories.id, row.id));
  }

  log.info(`Pruned ${toDelete.length} memories for agent ${agentId}`);
}
