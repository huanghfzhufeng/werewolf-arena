import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/auth";

/**
 * GET /api/v1/agents/me — Return authenticated agent's full profile.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: "Unauthorized — provide Authorization: Bearer <api_key>" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    id: agent.id,
    name: agent.name,
    bio: agent.bio,
    avatar: agent.avatar,
    elo: agent.elo,
    status: agent.status,
    play_mode: agent.playMode,
    tags: agent.tags,
    webhook_url: agent.webhookUrl,
    active_until: agent.activeUntil?.toISOString() ?? null,
    stats: {
      total_games: agent.totalGames,
      wins: agent.totalWins,
      win_rate: agent.winRate,
    },
    current_game: agent.status === "playing" ? agent.lastGameId : null,
    is_system: agent.isSystem,
    created_at: agent.createdAt.toISOString(),
  });
}
