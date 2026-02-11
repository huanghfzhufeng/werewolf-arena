import { NextResponse } from "next/server";
import { eq, desc, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, lobbies, lobbyMembers, games, agentMemories, players } from "@/db/schema";
import { MODE_LABELS } from "@/app/constants";
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
    // 1) SSE buffer events (simple status changes)
    const simpleEvents = getRecentCommunityEvents().slice(0, 10).map((ev) => {
      const d = ev.data;
      let text = "";
      let kind = "";
      let agent = "";
      if (ev.type === "agent_status_change") {
        const name = d.agentName as string;
        const to = d.to as string;
        agent = name;
        if (to === "queued")   { text = `${name} 加入了排队`; kind = "queue"; }
        else if (to === "playing")  { text = `${name} 开始对局`; kind = "playing"; }
        else if (to === "cooldown") { text = `${name} 进入休息`; kind = "cooldown"; }
        else if (to === "idle")     { text = `${name} 回到空闲`; kind = "idle"; }
      } else if (ev.type === "lobby_update") {
        agent = d.agentName as string;
        const modeName = MODE_LABELS[d.modeId as string] ?? (d.modeId as string);
        text = `${agent} ${d.action === "joined" ? "加入" : "离开"}了 ${modeName} 大厅 (${d.currentPlayers}/${d.requiredPlayers})`;
        kind = "lobby";
      } else if (ev.type === "game_auto_start") {
        text = `${d.modeName as string} 自动开局！`;
        kind = "game_start";
      } else if (ev.type === "game_end_summary") {
        return { id: crypto.randomUUID(), kind: "game_end_summary", time: ev.timestamp ?? new Date().toISOString(), ...d };
      } else if (ev.type === "agent_reflection") {
        return { id: crypto.randomUUID(), kind: "agent_reflection", time: ev.timestamp ?? new Date().toISOString(), ...d };
      } else if (ev.type === "agent_impression") {
        return { id: crypto.randomUUID(), kind: "agent_impression", time: ev.timestamp ?? new Date().toISOString(), content: d.impression, ...d };
      }
      if (!text) return null;
      return { id: crypto.randomUUID(), kind, text, agent, time: ev.timestamp ?? new Date().toISOString() };
    }).filter(Boolean);

    // 2) Fetch recent reflections from DB if SSE buffer is empty
    let dbEvents: Record<string, unknown>[] = [];
    if (simpleEvents.filter((e) => e && (e as { kind: string }).kind === "agent_reflection").length === 0) {
      const recentReflections = await db
        .select()
        .from(agentMemories)
        .where(eq(agentMemories.source, "reflection"))
        .orderBy(desc(agentMemories.createdAt))
        .limit(5);

      for (const mem of recentReflections) {
        const [a] = await db.select({ name: agents.name, avatar: agents.avatar }).from(agents).where(eq(agents.id, mem.agentId));
        if (a) {
          dbEvents.push({
            id: mem.id,
            kind: "agent_reflection",
            agentName: a.name,
            avatar: a.avatar,
            content: mem.content,
            time: mem.createdAt.toISOString(),
          });
        }
      }

      // Last finished game summary
      const [lastGame] = await db.select().from(games).where(eq(games.status, "finished")).orderBy(desc(games.finishedAt)).limit(1);
      if (lastGame && lastGame.winner) {
        const gamePlayers = await db.select().from(players).where(eq(players.gameId, lastGame.id));
        dbEvents.unshift({
          id: lastGame.id,
          kind: "game_end_summary",
          gameId: lastGame.id,
          winner: lastGame.winner,
          modeId: lastGame.modeId,
          modeName: MODE_LABELS[lastGame.modeId] ?? lastGame.modeId,
          round: lastGame.currentRound,
          players: gamePlayers.map((p) => ({
            name: p.agentName,
            avatar: (p.personality as { avatar?: string })?.avatar ?? "🎭",
            role: p.role ?? "villager",
          })),
          time: (lastGame.finishedAt ?? lastGame.createdAt).toISOString(),
        });
      }
    }

    const recent = [...simpleEvents, ...dbEvents];

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
        totalFinishedGames: await db.select({ count: sql<number>`count(*)` }).from(games).where(eq(games.status, "finished")).then((r) => Number(r[0]?.count ?? 0)),
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
