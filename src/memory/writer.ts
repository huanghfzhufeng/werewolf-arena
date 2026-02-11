import { db } from "@/db";
import { agentMemories } from "@/db/schema";
import type { Player } from "@/db/schema";
import { ROLE_CONFIGS } from "@/engine/roles";
import type { Role } from "@/engine/roles";
import { chatCompletion } from "@/agents/llm-client";
import { createLogger } from "@/lib";
import { eq, asc } from "drizzle-orm";
import type { MemoryEntry } from "./types";

const log = createLogger("Memory");

const MAX_MEMORIES_PER_AGENT = 100;

// ─── Low-level insert ───────────────────────────────────────────

async function insertMemory(entry: MemoryEntry): Promise<void> {
  await db.insert(agentMemories).values({
    agentId: entry.agentId,
    source: entry.source,
    gameId: entry.gameId ?? null,
    content: entry.content,
    tags: entry.tags,
    importance: entry.importance,
  });
}

// ─── Game Reflection (LLM-generated) ────────────────────────────

/**
 * After a game ends, ask the LLM to generate a 1-2 sentence reflection
 * for the agent based on their role, result, and key events.
 */
export async function writeGameReflection(
  agentId: string,
  gameId: string,
  player: Player,
  allPlayers: Player[],
  winner: "werewolf" | "villager",
  keyEvents: string[]
): Promise<void> {
  const role = (player.role ?? "villager") as Role;
  const roleConfig = ROLE_CONFIGS[role];
  const won = roleConfig.team === winner;

  const prompt = `You are ${player.agentName}, a ${roleConfig.nameZh}(${roleConfig.name}).
The game just ended. ${won ? "Your team WON!" : "Your team LOST."}
Other players: ${allPlayers.map((p) => `${p.agentName}(${ROLE_CONFIGS[(p.role ?? "villager") as Role].nameZh})`).join(", ")}
Key events:
${keyEvents.map((e) => `- ${e}`).join("\n")}

Write a 1-2 sentence self-reflection in Chinese about what happened, what you learned, and what you'd do differently. Be specific about player names and actions.`;

  try {
    const reflection = await chatCompletion(
      [{ role: "user", content: prompt }],
      { temperature: 0.7, maxTokens: 150 }
    );

    await insertMemory({
      agentId,
      source: "reflection",
      gameId,
      content: reflection,
      tags: [role, won ? "win" : "loss", ...extractPlayerTags(allPlayers)],
      importance: won ? 0.7 : 0.8, // losses are more instructive
    });

    log.info(`Wrote reflection for ${player.agentName}: ${reflection.slice(0, 60)}...`);
  } catch (err) {
    log.error(`Failed to write reflection for ${player.agentName}:`, err);
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
    ...keyEvents.slice(0, 10), // cap at 10 events
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

// ─── Social Memory (future moltbook) ────────────────────────────

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

// ─── Pruning ────────────────────────────────────────────────────

/**
 * Keep only the most recent / most important memories per agent.
 * Deletes the lowest-importance oldest entries beyond MAX_MEMORIES_PER_AGENT.
 */
export async function pruneMemories(agentId: string): Promise<void> {
  const all = await db
    .select({ id: agentMemories.id })
    .from(agentMemories)
    .where(eq(agentMemories.agentId, agentId))
    .orderBy(asc(agentMemories.importance), asc(agentMemories.createdAt));

  if (all.length <= MAX_MEMORIES_PER_AGENT) return;

  const toDelete = all.slice(0, all.length - MAX_MEMORIES_PER_AGENT);
  for (const row of toDelete) {
    await db.delete(agentMemories).where(eq(agentMemories.id, row.id));
  }

  log.info(`Pruned ${toDelete.length} memories for agent ${agentId}`);
}

// ─── Helpers ────────────────────────────────────────────────────

function extractPlayerTags(players: Player[]): string[] {
  return players.map((p) => p.agentName).filter(Boolean);
}
