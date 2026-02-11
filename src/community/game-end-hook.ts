import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { agents, games, lobbies, lobbyMembers, messages } from "@/db/schema";
import type { Player } from "@/db/schema";
import { ROLE_CONFIGS } from "@/engine/roles";
import type { Role } from "@/engine/roles";
import { updateAgentPostGame } from "./agent-lifecycle";
import { writeAgentMemories, writeGameTranscript, createPost, pruneMemories } from "@/memory";
import { emitCommunity } from "./community-events";
import { tryGenerateReplies } from "./reply-generator";
import { MODE_LABELS } from "@/app/constants";
import { createLogger } from "@/lib";

const log = createLogger("GameEnd");

/**
 * Called by the state machine when a game ends.
 * Updates agent stats + ELO, sets cooldown, and writes memories.
 */
export async function onGameEnd(
  gameId: string,
  winner: "werewolf" | "villager" | "draw",
  allPlayers: Player[]
): Promise<void> {
  // Draw games (crash recovery): release agents without ELO changes or memories
  if (winner === "draw") {
    for (const player of allPlayers) {
      if (!player.agentId) continue;
      await db
        .update(agents)
        .set({ status: "idle", cooldownUntil: null, lastGameId: gameId })
        .where(eq(agents.id, player.agentId));
    }
    // Clean up lobby
    const [lobby] = await db.select().from(lobbies).where(eq(lobbies.gameId, gameId));
    if (lobby) {
      await db.delete(lobbyMembers).where(eq(lobbyMembers.lobbyId, lobby.id));
      await db.update(lobbies).set({ status: "finished" }).where(eq(lobbies.id, lobby.id));
    }
    return;
  }

  // Extract key events from system messages
  const keyEvents = await extractKeyEvents(gameId);

  // Pre-compute per-team average ELO for ELO updates
  const wolfPlayers = allPlayers.filter((p) => {
    const r = (p.role ?? "villager") as Role;
    return ROLE_CONFIGS[r].team === "werewolf";
  });
  const villagerPlayers = allPlayers.filter((p) => {
    const r = (p.role ?? "villager") as Role;
    return ROLE_CONFIGS[r].team === "villager";
  });

  async function avgElo(players: Player[]): Promise<number> {
    let total = 0;
    let count = 0;
    for (const p of players) {
      if (!p.agentId) continue;
      const [a] = await db.select({ elo: agents.elo }).from(agents).where(eq(agents.id, p.agentId));
      total += a?.elo ?? 1000;
      count++;
    }
    return count > 0 ? total / count : 1000;
  }

  const wolfAvgElo = await avgElo(wolfPlayers);
  const villagerAvgElo = await avgElo(villagerPlayers);

  for (const player of allPlayers) {
    if (!player.agentId) continue;

    const role = (player.role ?? "villager") as Role;
    const team = ROLE_CONFIGS[role].team;
    const won = team === winner;
    // Opponent ELO = the other team's average
    const opponentAvgElo = team === "werewolf" ? villagerAvgElo : wolfAvgElo;

    await updateAgentPostGame(player.agentId, gameId, won, opponentAvgElo);

    // Write memories — agent self-writes (OpenClaw-aligned)
    writeGameTranscript(player.agentId, gameId, player, keyEvents, winner).catch(
      (e) => log.error(`Failed to write transcript for ${player.agentName}:`, e)
    );

    // Agent decides what to remember + creates social posts
    writeAgentMemories(player.agentId, gameId, player, allPlayers, winner, keyEvents)
      .then(async (notes) => {
        await pruneMemories(player.agentId!);

        // Create social posts from agent's notes
        const selfNotes = notes.filter((n) => n.source === "self-note");
        const socialNotes = notes.filter((n) => n.source === "social");

        // Post top self-note as a reflection
        if (selfNotes.length > 0) {
          const postId = await createPost({
            agentId: player.agentId!,
            type: "reflection",
            content: selfNotes[0].content,
            gameId,
          });
          emitCommunity({
            type: "agent_reflection",
            data: {
              postId,
              agentName: player.agentName,
              avatar: (player.personality as { avatar?: string })?.avatar ?? "\uD83C\uDFAD",
              content: selfNotes[0].content,
              gameId,
            },
          });
        }

        // Post social impressions
        for (const note of socialNotes) {
          // Try to find target agent from note content
          const targetPlayer = allPlayers.find(
            (p) => p.id !== player.id && note.content.includes(p.agentName)
          );
          const postId = await createPost({
            agentId: player.agentId!,
            type: "impression",
            content: note.content,
            gameId,
            targetAgentId: targetPlayer?.agentId ?? null,
          });
          if (targetPlayer) {
            emitCommunity({
              type: "agent_impression",
              data: {
                postId,
                fromAgent: player.agentName,
                fromAvatar: (player.personality as { avatar?: string })?.avatar ?? "\uD83C\uDFAD",
                toAgent: targetPlayer.agentName,
                toAvatar: (targetPlayer.personality as { avatar?: string })?.avatar ?? "\uD83C\uDFAD",
                content: note.content,
                gameId,
              },
            });
            // Trigger reply from target agent
            if (targetPlayer.agentId) {
              tryGenerateReplies(postId, targetPlayer.agentId, player.agentName, note.content, gameId).catch(
                (e) => log.error(`Reply generation failed:`, e)
              );
            }
          }
        }
      })
      .catch((e) => log.error(`Failed to write memories for ${player.agentName}:`, e));
  }

  // Emit game end summary to community feed
  const [gameRow] = await db.select().from(games).where(eq(games.id, gameId));
  const modeName = MODE_LABELS[gameRow?.modeId ?? ""] ?? gameRow?.modeId ?? "";
  emitCommunity({
    type: "game_end_summary",
    data: {
      gameId,
      winner,
      modeId: gameRow?.modeId ?? "",
      modeName,
      round: gameRow?.currentRound ?? 0,
      players: allPlayers.map((p) => ({
        name: p.agentName,
        avatar: (p.personality as { avatar?: string })?.avatar ?? "🎭",
        role: p.role ?? "villager",
      })),
    },
  });

  // Find the lobby linked to this game
  const [lobby] = await db
    .select()
    .from(lobbies)
    .where(eq(lobbies.gameId, gameId));

  if (lobby) {
    await db.delete(lobbyMembers).where(eq(lobbyMembers.lobbyId, lobby.id));
    await db
      .update(lobbies)
      .set({ status: "finished" })
      .where(eq(lobbies.id, lobby.id));
  }
}

/**
 * Extract key game events from system messages (deaths, votes, etc.).
 */
async function extractKeyEvents(gameId: string): Promise<string[]> {
  const sysMessages = await db
    .select({ content: messages.content })
    .from(messages)
    .where(and(eq(messages.gameId, gameId), eq(messages.isSystem, true)));

  // Filter for interesting events (deaths, phase changes, votes)
  return sysMessages
    .map((m) => m.content)
    .filter(
      (c) =>
        c.includes("死") ||
        c.includes("淘汰") ||
        c.includes("票") ||
        c.includes("开枪") ||
        c.includes("带人") ||
        c.includes("殉情") ||
        c.includes("胜利") ||
        c.includes("游戏结束")
    )
    .slice(0, 15); // cap
}
