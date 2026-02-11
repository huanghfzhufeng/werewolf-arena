import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { agents, players, games, agentMemories, agentOwners } from "@/db/schema";
import { createLogger } from "@/lib";

const log = createLogger("API:Agent");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 }
      );
    }

    const personality = agent.personality;

    // Recent games via players table
    const recentPlayers = await db
      .select()
      .from(players)
      .where(eq(players.agentId, id))
      .orderBy(desc(players.id))
      .limit(10);

    const recentGames = await Promise.all(
      recentPlayers.map(async (p) => {
        const [game] = await db
          .select()
          .from(games)
          .where(eq(games.id, p.gameId));
        if (!game) return null;
        return {
          gameId: game.id,
          modeId: game.modeId,
          status: game.status,
          winner: game.winner,
          role: game.status === "finished" ? p.role : null,
          isAlive: p.isAlive,
          createdAt: game.createdAt,
          finishedAt: game.finishedAt,
        };
      })
    );

    // Recent memories (reflections + social impressions)
    const memories = await db
      .select()
      .from(agentMemories)
      .where(eq(agentMemories.agentId, id))
      .orderBy(desc(agentMemories.createdAt))
      .limit(10);

    // Fetch owner info if agent has an owner
    let ownerInfo: { displayName: string; avatarUrl: string | null } | null = null;
    if (agent.ownerId) {
      const [o] = await db.select({ displayName: agentOwners.displayName, avatarUrl: agentOwners.avatarUrl }).from(agentOwners).where(eq(agentOwners.id, agent.ownerId));
      if (o) ownerInfo = o;
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar,
        status: agent.status,
        cooldownUntil: agent.cooldownUntil,
        totalGames: agent.totalGames,
        totalWins: agent.totalWins,
        winRate: agent.winRate,
        personality,
        createdAt: agent.createdAt,
        elo: agent.elo,
        isSystem: agent.isSystem,
        playMode: agent.playMode,
        bio: agent.bio,
        tags: agent.tags,
        ownerId: agent.ownerId,
        owner: ownerInfo,
      },
      recentGames: recentGames.filter(Boolean),
      memories: memories.map((m) => ({
        id: m.id,
        source: m.source,
        content: m.content,
        tags: m.tags,
        importance: m.importance,
        gameId: m.gameId,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    log.error("Failed to get agent:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get agent" },
      { status: 500 }
    );
  }
}
