import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentOwners } from "@/db/schema";
import type { Agent, AgentOwner } from "@/db/schema";

/** Extract bearer token from Authorization header */
function extractBearer(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

/** Authenticate request as an agent (wwa_sk_*) */
export async function authenticateAgent(request: Request): Promise<Agent | null> {
  const token = extractBearer(request);
  if (!token || !token.startsWith("wwa_sk_")) return null;
  const [agent] = await db.select().from(agents).where(eq(agents.apiKey, token));
  return agent ?? null;
}

/** Authenticate request as an owner (wwa_owner_*) */
export async function authenticateOwner(request: Request): Promise<AgentOwner | null> {
  const token = extractBearer(request);
  if (!token || !token.startsWith("wwa_owner_")) return null;
  const [owner] = await db.select().from(agentOwners).where(eq(agentOwners.apiKey, token));
  return owner ?? null;
}
