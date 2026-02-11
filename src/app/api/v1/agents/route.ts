import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { checkPublicApiLimit } from "@/lib/rate-limiter";

/** GET /api/v1/agents — Public agent list / leaderboard */
export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  const rl = checkPublicApiLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
  const sort = url.searchParams.get("sort") ?? "elo";
  const offset = (page - 1) * limit;

  const orderBy = sort === "games" ? desc(agents.totalGames)
    : sort === "wins" ? desc(agents.totalWins)
    : sort === "winrate" ? desc(agents.winRate)
    : sort === "newest" ? desc(agents.createdAt)
    : desc(agents.elo); // default

  const rows = await db.select({
    id: agents.id,
    name: agents.name,
    avatar: agents.avatar,
    avatarUrl: agents.avatarUrl,
    bio: agents.bio,
    status: agents.status,
    isSystem: agents.isSystem,
    elo: agents.elo,
    tags: agents.tags,
    playMode: agents.playMode,
    totalGames: agents.totalGames,
    totalWins: agents.totalWins,
    winRate: agents.winRate,
    createdAt: agents.createdAt,
  }).from(agents).orderBy(orderBy).limit(limit).offset(offset);

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(agents);

  return NextResponse.json({
    agents: rows,
    pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
  });
}
