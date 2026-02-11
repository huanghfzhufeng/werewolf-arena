import { loadRoleSkills } from "@/skills";
import type { RoleFrontmatter } from "@/skills";

export type Role =
  | "werewolf"
  | "wolf_king"
  | "white_wolf"
  | "seer"
  | "witch"
  | "guard"
  | "hunter"
  | "elder"
  | "cupid"
  | "madman"
  | "villager";

export type Team = "werewolf" | "villager";

export type DeathTrigger = "hunter_shoot" | "wolf_king_revenge" | "white_wolf_explode" | null;

export type RoleConfig = {
  name: string;
  nameZh: string;
  team: Team;
  hasNightAction: boolean;
  nightPhase: string | null;
  nightPriority: number;
  deathTrigger: DeathTrigger;
  /** LLM prompt body loaded from ROLE.md */
  description: string;
  descriptionZh: string;
};

/**
 * Build a RoleConfig from a skill's frontmatter + body.
 * This bridges the skill system to the existing engine interface.
 */
function toRoleConfig(meta: RoleFrontmatter, body: string): RoleConfig {
  return {
    name: meta.name,
    nameZh: meta.nameZh,
    team: meta.team,
    hasNightAction: meta.hasNightAction,
    nightPhase: meta.nightPhase,
    nightPriority: meta.nightPriority,
    deathTrigger: meta.deathTrigger as DeathTrigger,
    description: body,
    descriptionZh: meta.descriptionZh,
  };
}

/**
 * Lazily-built ROLE_CONFIGS populated from skills/roles/ markdown files.
 * Keeps backward compatibility — all existing code using ROLE_CONFIGS[role] still works.
 */
let _roleConfigs: Record<string, RoleConfig> | null = null;

export function getRoleConfigs(): Record<string, RoleConfig> {
  if (_roleConfigs) return _roleConfigs;

  const skills = loadRoleSkills();
  const configs: Record<string, RoleConfig> = {};
  for (const [name, skill] of skills) {
    configs[name] = toRoleConfig(skill.meta, skill.body);
  }
  _roleConfigs = configs;
  return configs;
}

/** Backward-compatible accessor — get config for a single role */
export function getRoleConfig(roleId: Role): RoleConfig {
  const configs = getRoleConfigs();
  const config = configs[roleId];
  if (!config) throw new Error(`Unknown role: ${roleId}`);
  return config;
}

/**
 * ROLE_CONFIGS proxy — existing code like ROLE_CONFIGS[role] keeps working
 * via a lazy-loading Proxy that delegates to getRoleConfigs().
 */
export const ROLE_CONFIGS: Record<Role, RoleConfig> = new Proxy(
  {} as Record<Role, RoleConfig>,
  {
    get(_target, prop: string) {
      return getRoleConfigs()[prop];
    },
    ownKeys() {
      return Object.keys(getRoleConfigs());
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      const val = getRoleConfigs()[prop];
      if (val === undefined) return undefined;
      return { configurable: true, enumerable: true, value: val };
    },
    has(_target, prop: string) {
      return prop in getRoleConfigs();
    },
  }
);

/** Check if a role is on the werewolf team */
export function isWerewolfTeam(role: Role): boolean {
  return getRoleConfig(role).team === "werewolf";
}

/** Shuffle an array (Fisher-Yates) */
export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
