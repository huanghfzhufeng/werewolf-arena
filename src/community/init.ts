import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, lobbies } from "@/db/schema";
import { PERSONALITIES } from "@/agents/personalities";
import { getAllGameModes } from "@/engine/game-modes";
import { createLogger } from "@/lib";

const log = createLogger("Community");

/**
 * Initialize the community: ensure system agents exist, create lobbies.
 * Safe to call multiple times — idempotent.
 */
export async function initCommunity(): Promise<{ created: boolean }> {
  // Seed system agents (mark existing ones, add missing ones)
  const existing = await db.select().from(agents).where(eq(agents.isSystem, true));
  const existingNames = new Set(existing.map((a) => a.name));

  // Mark any old untagged agents as system (one-time migration)
  if (existing.length === 0) {
    const allAgents = await db.select().from(agents);
    const systemNames = new Set(PERSONALITIES.map((p) => p.character));
    for (const a of allAgents) {
      if (systemNames.has(a.name)) {
        await db.update(agents).set({ isSystem: true }).where(eq(agents.id, a.id));
        existingNames.add(a.name);
      }
    }
  }

  // Add any missing system agents
  let seeded = 0;
  const count = Math.min(PERSONALITIES.length, 20);
  for (let i = 0; i < count; i++) {
    const p = PERSONALITIES[i];
    if (existingNames.has(p.character)) continue;
    await db.insert(agents).values({
      name: p.character,
      personality: p,
      avatar: p.avatar,
      status: "idle",
      isSystem: true,
    });
    seeded++;
  }
  if (seeded > 0) {
    log.info(`Seeded ${seeded} system agents.`);
  } else {
    const totalAgents = await db.select().from(agents);
    log.info(`${totalAgents.length} agents (${existingNames.size} system).`);
  }

  // Ensure exactly one waiting lobby per mode (idempotent)
  const modes = getAllGameModes();
  const existingLobbies = await db
    .select()
    .from(lobbies)
    .where(eq(lobbies.status, "waiting"));

  const modesWithLobby = new Set(existingLobbies.map((l) => l.modeId));
  let lobbiesCreated = 0;
  for (const mode of modes) {
    if (!modesWithLobby.has(mode.id)) {
      await db.insert(lobbies).values({
        modeId: mode.id,
        status: "waiting",
        requiredPlayers: mode.playerCount,
      });
      lobbiesCreated++;
    }
  }
  if (lobbiesCreated > 0) {
    log.info(`Created ${lobbiesCreated} missing lobbies.`);
  }

  return { created: existing.length === 0 };
}
