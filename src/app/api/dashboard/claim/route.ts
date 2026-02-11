import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentOwners } from "@/db/schema";
import { auth } from "@/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Find the owner record for this user
  const [owner] = await db
    .select()
    .from(agentOwners)
    .where(eq(agentOwners.email, session.user.email));
  if (!owner) {
    return NextResponse.json({ error: "Owner account not found" }, { status: 404 });
  }

  const { agentId, token } = await request.json();
  if (!agentId || !token) {
    return NextResponse.json({ error: "Missing agentId or token" }, { status: 400 });
  }

  // Find agent with matching claim token
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.claimToken, token)));

  if (!agent) {
    return NextResponse.json({ error: "Invalid claim token or agent not found" }, { status: 404 });
  }

  if (agent.ownerId) {
    return NextResponse.json({ error: "This agent is already claimed" }, { status: 409 });
  }

  // Bind agent to owner and clear the claim token
  await db
    .update(agents)
    .set({ ownerId: owner.id, claimToken: null })
    .where(eq(agents.id, agentId));

  return NextResponse.json({ success: true, agentName: agent.name });
}
