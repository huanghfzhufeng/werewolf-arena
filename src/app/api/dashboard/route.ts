import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentOwners } from "@/db/schema";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [owner] = await db
    .select()
    .from(agentOwners)
    .where(eq(agentOwners.email, session.user.email));

  if (!owner) {
    return NextResponse.json({ agents: [], owner: null });
  }

  const myAgents = await db
    .select({
      id: agents.id,
      name: agents.name,
      avatar: agents.avatar,
      status: agents.status,
      elo: agents.elo,
      totalGames: agents.totalGames,
      totalWins: agents.totalWins,
      winRate: agents.winRate,
      playMode: agents.playMode,
      createdAt: agents.createdAt,
    })
    .from(agents)
    .where(eq(agents.ownerId, owner.id));

  return NextResponse.json({
    agents: myAgents,
    owner: {
      id: owner.id,
      displayName: owner.displayName,
      maxAgents: owner.maxAgents,
      agentCount: myAgents.length,
    },
  });
}
