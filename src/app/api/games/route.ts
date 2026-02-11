import { NextResponse } from "next/server";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, players } from "@/db/schema";
import { assignPersonalities } from "@/agents/personalities";
import { getGameMode } from "@/engine/game-modes";
import { createLogger } from "@/lib";

const log = createLogger("API:Games");

// POST /api/games — create a new game with AI agents
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const modeId = body.modeId ?? "classic-6p";
    const mode = getGameMode(modeId);

    const [game] = await db.insert(games).values({ modeId }).returning();
    const personalities = assignPersonalities(mode.playerCount);

    for (let i = 0; i < mode.playerCount; i++) {
      await db.insert(players).values({
        gameId: game.id,
        agentName: personalities[i].character,
        personality: personalities[i],
        seatNumber: i + 1,
      });
    }

    return NextResponse.json({
      success: true,
      game: { id: game.id, status: game.status, modeId },
    });
  } catch (error) {
    log.error("Failed to create game:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create game" },
      { status: 500 }
    );
  }
}

// GET /api/games — list games with optional status filter and pagination
// ?status=finished&page=1&limit=20
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const offset = (page - 1) * limit;

    // Build query with optional status filter
    const validStatuses = ["lobby", "playing", "finished"] as const;
    const typedStatus = validStatuses.find((s) => s === status);
    const condition = typedStatus ? eq(games.status, typedStatus) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(condition);
    const total = Number(countResult.count);

    const recentGames = await db
      .select()
      .from(games)
      .where(condition)
      .orderBy(desc(games.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch players for each game (for avatars on cards)
    const gameIds = recentGames.map((g) => g.id);
    const allPlayers =
      gameIds.length > 0
        ? await db
            .select({
              gameId: players.gameId,
              agentName: players.agentName,
              personality: players.personality,
            })
            .from(players)
            .where(inArray(players.gameId, gameIds))
        : [];

    const playersByGame = new Map<string, typeof allPlayers>();
    for (const p of allPlayers) {
      if (!playersByGame.has(p.gameId)) playersByGame.set(p.gameId, []);
      playersByGame.get(p.gameId)!.push(p);
    }

    const gamesWithPlayers = recentGames.map((g) => ({
      id: g.id,
      modeId: g.modeId,
      status: g.status,
      winner: g.winner,
      currentRound: g.currentRound,
      createdAt: g.createdAt,
      finishedAt: g.finishedAt,
      players: (playersByGame.get(g.id) ?? []).map((p) => {
        const pers = p.personality as Record<string, unknown> | null;
        return { name: p.agentName, avatar: (pers?.avatar as string) ?? "🎭" };
      }),
    }));

    return NextResponse.json({
      success: true,
      games: gamesWithPlayers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    log.error("Failed to list games:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list games" },
      { status: 500 }
    );
  }
}
