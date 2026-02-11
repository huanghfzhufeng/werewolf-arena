import { getRoleSkill } from "./loader";
import { getRoundEvents } from "./events";
import { createLogger } from "@/lib";

const log = createLogger("SkillResolver");

/**
 * Resolve context for a skill based on its `requires.context` declaration.
 *
 * Scans all events emitted during the current game round and extracts
 * the named values from event data.
 *
 * Example: witch skill declares `requires.context: [wolfVictimId, wolfVictimName]`
 * → looks through round events for data keys matching those names.
 */
export function resolveSkillContext(
  roleId: string,
  gameId: string,
  round: number
): Record<string, unknown> {
  const skill = getRoleSkill(roleId);
  if (!skill) return {};

  const requiredKeys = skill.meta.requires?.context;
  if (!requiredKeys || requiredKeys.length === 0) return {};

  const events = getRoundEvents(gameId, round);
  const context: Record<string, unknown> = {};

  for (const key of requiredKeys) {
    // Search through all events for this key
    for (const event of events) {
      if (key in event.data) {
        context[key] = event.data[key];
        break; // first match wins
      }
    }
  }

  const missing = requiredKeys.filter((k) => !(k in context));
  if (missing.length > 0) {
    log.debug(
      `Role "${roleId}" missing context keys: ${missing.join(", ")} (may be expected)`
    );
  }

  return context;
}
