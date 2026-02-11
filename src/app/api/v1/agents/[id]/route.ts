import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { agents, players, games, lobbyMembers, agentMemories } from "@/db/schema";
import { authenticateAgent } from "@/lib/auth";
import { createLogger } from "@/lib";
import { validateWebhookUrl } from "@/lib/url-validator";

const log = createLogger("API:v1:Agent");

/** GET /api/v1/agents/:id — Public agent profile */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    let personality = null;
    try { personality = JSON.parse(agent.personality); } catch { /* */ }

    const recentPlayers = await db.select().from(players)
      .where(eq(players.agentId, id)).orderBy(desc(players.id)).limit(10);
    const recentGames = await Promise.all(
      recentPlayers.map(async (p) => {
        const [game] = await db.select().from(games).where(eq(games.id, p.gameId));
        if (!game) return null;
        return {
          gameId: game.id, modeId: game.modeId, status: game.status,
          winner: game.winner, role: game.status === "finished" ? p.role : null,
          isAlive: p.isAlive, createdAt: game.createdAt, finishedAt: game.finishedAt,
        };
      })
    );

    return NextResponse.json({
      agent: {
        id: agent.id, name: agent.name, avatar: agent.avatar, avatarUrl: agent.avatarUrl,
        bio: agent.bio, status: agent.status, isSystem: agent.isSystem,
        elo: agent.elo, tags: agent.tags, playMode: agent.playMode,
        totalGames: agent.totalGames, totalWins: agent.totalWins, winRate: agent.winRate,
        personality, createdAt: agent.createdAt,
      },
      recentGames: recentGames.filter(Boolean),
    });
  } catch (error) {
    log.error("Failed to get agent:", error);
    return NextResponse.json({ error: "Failed to get agent" }, { status: 500 });
  }
}

/** PUT /api/v1/agents/:id — Update agent (requires agent api_key) */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authedAgent = await authenticateAgent(request);
    if (!authedAgent || authedAgent.id !== id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.bio !== undefined) updates.bio = body.bio;
    if (body.avatar !== undefined) updates.avatar = body.avatar;
    if (body.avatar_url !== undefined) updates.avatarUrl = body.avatar_url;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.webhook_url !== undefined) {
      if (body.webhook_url) {
        const urlCheck = validateWebhookUrl(body.webhook_url);
        if (!urlCheck.valid) {
          return NextResponse.json(
            { error: `Invalid webhook_url: ${urlCheck.reason}` },
            { status: 400 }
          );
        }
      }
      updates.webhookUrl = body.webhook_url || null;
    }
    if (body.play_mode !== undefined) {
      updates.playMode = body.play_mode === "autonomous" ? "autonomous" : "hosted";
    }
    if (body.personality) {
      const existing = JSON.parse(authedAgent.personality);
      const merged = { ...existing, ...body.personality };
      updates.personality = JSON.stringify(merged);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await db.update(agents).set(updates).where(eq(agents.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Failed to update agent:", error);
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}

/** DELETE /api/v1/agents/:id — Delete agent (requires agent api_key) */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authedAgent = await authenticateAgent(request);
    if (!authedAgent || authedAgent.id !== id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (authedAgent.isSystem) {
      return NextResponse.json({ error: "Cannot delete system agents" }, { status: 403 });
    }
    if (authedAgent.status === "playing") {
      return NextResponse.json({ error: "Cannot delete agent while in a game" }, { status: 409 });
    }

    // Clean up FK references before deleting
    await db.delete(lobbyMembers).where(eq(lobbyMembers.agentId, id));
    await db.delete(agentMemories).where(eq(agentMemories.agentId, id));
    // Nullify agentId on players (preserve game history)
    await db.update(players).set({ agentId: null }).where(eq(players.agentId, id));
    await db.delete(agents).where(eq(agents.id, id));
    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    log.error("Failed to delete agent:", error);
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}
