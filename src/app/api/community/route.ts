import { NextResponse } from "next/server";
import { eq, desc, ne } from "drizzle-orm";
import { db } from "@/db";
import { agents, lobbies, lobbyMembers, games } from "@/db/schema";
import { startCommunityEngine, isEngineRunning } from "@/community/community-engine";
import { getRecentCommunityEvents } from "@/community/community-events";
import { getAllGameModes } from "@/engine/game-modes";
import { createLogger } from "@/lib";

const log = createLogger("API:Community");

// GET /api/community — community status: agents, lobbies, stats
export async function GET() {
  try {
    // Ensure engine is running
    if (!isEngineRunning()) {
      await startCommunityEngine();
    }

    // Exclude dormant agents from the community view
    const allAgents = await db.select().from(agents).where(ne(agents.status, "dormant"));
    const waitingLobbies = await db
      .select()
      .from(lobbies)
      .where(eq(lobbies.status, "waiting"));

    // Get lobby member counts
    const lobbyData = await Promise.all(
      waitingLobbies.map(async (lobby) => {
        const members = await db
          .select()
          .from(lobbyMembers)
          .where(eq(lobbyMembers.lobbyId, lobby.id));
        const memberAgents = await Promise.all(
          members.map(async (m) => {
            const [a] = await db.select().from(agents).where(eq(agents.id, m.agentId));
            return a ? { id: a.id, name: a.name, avatar: a.avatar } : null;
          })
        );
        return {
          id: lobby.id,
          modeId: lobby.modeId,
          currentPlayers: members.length,
          requiredPlayers: lobby.requiredPlayers,
          members: memberAgents.filter(Boolean),
        };
      })
    );

    // Active games
    const activeGames = await db
      .select()
      .from(games)
      .where(eq(games.status, "playing"))
      .orderBy(desc(games.createdAt));

    // Stats
    const statusCounts: Record<string, number> = {};
    for (const a of allAgents) {
      statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
    }

    const modes = getAllGameModes();

    // Build recent events for initial live feed
    const recent = getRecentCommunityEvents().slice(0, 10).map((ev) => {
      const d = ev.data;
      let text = "";
      if (ev.type === "agent_status_change") {
        const name = d.agentName as string;
        const to = d.to as string;
        if (to === "queued") text = `${name} 加入了排队`;
        else if (to === "playing") text = `${name} 开始对局`;
        else if (to === "cooldown") text = `${name} 进入休息`;
        else if (to === "idle") text = `${name} 回到空闲`;
      } else if (ev.type === "lobby_update") {
        text = `${d.agentName as string} ${d.action === "joined" ? "加入" : "离开"}了 ${d.modeId as string} 大厅`;
      } else if (ev.type === "game_auto_start") {
        text = `🎮 ${d.modeName as string} 自动开局！`;
      }
      if (!text) return null;
      return { id: crypto.randomUUID(), text, time: ev.timestamp ?? new Date().toISOString() };
    }).filter(Boolean);

    return NextResponse.json({
      success: true,
      engineRunning: isEngineRunning(),
      agents: allAgents.map((a) => ({
        id: a.id,
        name: a.name,
        avatar: a.avatar,
        status: a.status,
        cooldownUntil: a.cooldownUntil,
        totalGames: a.totalGames,
        totalWins: a.totalWins,
        winRate: a.winRate,
        lastGameId: a.lastGameId,
        elo: a.elo,
        isSystem: a.isSystem,
        playMode: a.playMode,
        tags: a.tags,
      })),
      lobbies: lobbyData,
      activeGames: activeGames.map((g) => ({
        id: g.id,
        modeId: g.modeId,
        currentRound: g.currentRound,
        createdAt: g.createdAt,
      })),
      stats: {
        totalAgents: allAgents.length,
        ...statusCounts,
      },
      modes: modes.map((m) => ({
        id: m.id,
        nameZh: m.nameZh,
        playerCount: m.playerCount,
        descriptionZh: m.descriptionZh,
      })),
      recentEvents: recent,
    });
  } catch (error) {
    log.error("Failed to get community status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get community status" },
      { status: 500 }
    );
  }
}

// POST /api/community — start the community engine
export async function POST() {
  try {
    await startCommunityEngine();
    return NextResponse.json({ success: true, running: isEngineRunning() });
  } catch (error) {
    log.error("Failed to start community engine:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start engine" },
      { status: 500 }
    );
  }
}
