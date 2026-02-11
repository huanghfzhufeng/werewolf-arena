import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { games, players, messages, votes, actions } from "@/db/schema";
import type { FeedItem } from "@/components/game/types";

/**
 * GET /api/games/:id/replay — Full enriched timeline for game replay.
 * Only available for finished games.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    if (game.status !== "finished") {
      return NextResponse.json(
        { error: "Replay is only available for finished games" },
        { status: 400 }
      );
    }

    const gamePlayers = await db
      .select()
      .from(players)
      .where(eq(players.gameId, id));

    const gameMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.gameId, id))
      .orderBy(asc(messages.createdAt));

    const gameVotes = await db
      .select()
      .from(votes)
      .where(eq(votes.gameId, id))
      .orderBy(asc(votes.createdAt));

    const gameActions = await db
      .select()
      .from(actions)
      .where(eq(actions.gameId, id))
      .orderBy(asc(actions.createdAt));

    const playerMap = new Map(gamePlayers.map((p) => [p.id, p]));

    // Build unified timeline
    const timeline: FeedItem[] = [];

    // Messages → message / system / last_words
    for (const m of gameMessages) {
      const isLastWords = m.content.startsWith("[遗言]") || m.phase === "game_over";
      timeline.push({
        id: m.id,
        kind: m.isSystem ? "system" : isLastWords ? "last_words" : "message",
        playerId: m.playerId ?? undefined,
        content: isLastWords ? m.content.replace("[遗言] ", "") : m.content,
        isPrivate: m.isPrivate,
        round: m.round,
        timestamp: m.createdAt.toISOString(),
      });
    }

    // Votes → vote items
    for (const v of gameVotes) {
      const voter = playerMap.get(v.voterId);
      const target = playerMap.get(v.targetId);
      if (!voter || !target) continue;
      timeline.push({
        id: v.id,
        kind: "vote",
        playerId: v.voterId,
        content: `投给了 ${target.agentName}`,
        round: v.round,
        timestamp: v.createdAt.toISOString(),
        extra: { targetId: v.targetId, targetName: target.agentName },
      });
    }

    // Actions → seer_result
    for (const a of gameActions) {
      if (a.actionType === "seer_check") {
        const target = playerMap.get(a.targetId);
        if (!target) continue;
        const resultLabel = a.result === "werewolf" ? "🐺 狼人" : "👤 好人";
        timeline.push({
          id: a.id,
          kind: "seer_result",
          playerId: a.playerId,
          content: `查验了 ${target.agentName}，结果是：${resultLabel}`,
          round: a.round,
          timestamp: a.createdAt.toISOString(),
        });
      }
    }

    // Sort by timestamp
    timeline.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return NextResponse.json({
      success: true,
      game,
      players: gamePlayers.map((p) => ({
        id: p.id,
        agentName: p.agentName,
        seatNumber: p.seatNumber,
        isAlive: p.isAlive,
        role: p.role,
        personality: p.personality,
      })),
      timeline,
    });
  } catch (error) {
    console.error("Replay API error:", error);
    return NextResponse.json(
      { error: "Failed to load replay" },
      { status: 500 }
    );
  }
}
