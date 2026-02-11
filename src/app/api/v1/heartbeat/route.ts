import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { authenticateAgent } from "@/lib/auth";
import { joinLobby } from "@/community/matchmaker";
import { getAllGameModes } from "@/engine/game-modes";
import { createLogger } from "@/lib";
import { resetWebhookFailures } from "@/agents/webhook-runner";
import { checkHeartbeatLimit } from "@/lib/rate-limiter";

const log = createLogger("API:v1:Heartbeat");

const ACTIVE_DAYS = 7;

/**
 * POST /api/v1/heartbeat — Agent check-in (Moltbook-style)
 * Renews active_until, optionally auto-queues for a game.
 */
export async function POST(request: Request) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized — provide Authorization: Bearer <api_key>" }, { status: 401 });
    }

    // Rate limit by agent
    const rl = checkHeartbeatLimit(agent.id);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many heartbeat requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const preferredModes: string[] = body.preferred_modes ?? [];
    const autoQueue: boolean = body.auto_queue ?? true;

    // Renew active period + reactivate if dormant
    const activeUntil = new Date(Date.now() + ACTIVE_DAYS * 24 * 60 * 60 * 1000);
    const updates: Record<string, unknown> = { activeUntil };
    if (agent.status === "dormant") {
      updates.status = "idle";
    }
    await db.update(agents).set(updates).where(eq(agents.id, agent.id));

    // Reset webhook failure counter (allows re-enabling autonomous mode)
    resetWebhookFailures(agent.id);

    // Auto-queue if idle (or just reactivated from dormant) and requested
    let queueStatus: string | null = null;
    const effectiveStatus = agent.status === "dormant" ? "idle" : agent.status;
    if (autoQueue && effectiveStatus === "idle") {
      const modes = getAllGameModes();
      // Pick a mode: prefer user's preference, fallback to smallest mode
      let targetMode = modes[0];
      if (preferredModes.length > 0) {
        const preferred = modes.find((m) => preferredModes.includes(m.id));
        if (preferred) targetMode = preferred;
      }
      if (targetMode) {
        const result = await joinLobby(agent, targetMode.id);
        queueStatus = result.joined
          ? `queued_for_${targetMode.id}`
          : "queue_failed";
      }
    }

    // Refresh agent data
    const [fresh] = await db.select().from(agents).where(eq(agents.id, agent.id));

    return NextResponse.json({
      status: "active",
      active_until: activeUntil.toISOString(),
      stats: {
        elo: fresh.elo,
        total_games: fresh.totalGames,
        wins: fresh.totalWins,
        win_rate: fresh.winRate,
      },
      current_game: fresh.lastGameId && fresh.status === "playing" ? fresh.lastGameId : null,
      agent_status: fresh.status,
      queue_status: queueStatus,
    });
  } catch (error) {
    log.error("Heartbeat failed:", error);
    return NextResponse.json({ error: "Heartbeat failed" }, { status: 500 });
  }
}
