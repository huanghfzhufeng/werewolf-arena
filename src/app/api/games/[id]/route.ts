import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { games, players, messages } from "@/db/schema";
import { startGame } from "@/engine/state-machine";
import { createLogger } from "@/lib";

const log = createLogger("API:Game");

// GET /api/games/:id — get game state
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    if (!game) {
      return NextResponse.json(
        { success: false, error: "Game not found" },
        { status: 404 }
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

    // Hide roles from observers unless game is finished
    const safePlayers = gamePlayers.map((p) => ({
      id: p.id,
      agentName: p.agentName,
      seatNumber: p.seatNumber,
      isAlive: p.isAlive,
      role: game.status === "finished" ? p.role : undefined,
      personality: p.personality,
    }));

    return NextResponse.json({
      success: true,
      game,
      players: safePlayers,
      messages: gameMessages,
    });
  } catch (error) {
    log.error("Failed to get game:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get game" },
      { status: 500 }
    );
  }
}

// POST /api/games/:id — start the game
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    if (!game) {
      return NextResponse.json(
        { success: false, error: "Game not found" },
        { status: 404 }
      );
    }
    if (game.status !== "lobby") {
      return NextResponse.json(
        { success: false, error: "Game already started" },
        { status: 400 }
      );
    }

    // Start game (non-blocking — the game loop runs in background)
    startGame(id).catch((err) => {
      log.error(`Failed to start game ${id}:`, err);
    });

    return NextResponse.json({ success: true, message: "Game started!" });
  } catch (error) {
    log.error("Failed to start game:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start game" },
      { status: 500 }
    );
  }
}
