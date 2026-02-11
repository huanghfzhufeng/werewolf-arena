import { loadModeSkills } from "@/skills";
import type { ModeFrontmatter } from "@/skills";
import type { Role } from "./roles";

export type NightPhase =
  | "night_cupid"
  | "night_guard"
  | "night_werewolf"
  | "night_seer"
  | "night_witch";

export type GameMode = {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  playerCount: number;
  roleDistribution: Role[];
  nightPhaseOrder: NightPhase[];
  hasDeathTriggers: boolean;
};

/**
 * Build a GameMode from a skill's frontmatter + body.
 */
function toGameMode(meta: ModeFrontmatter, body: string): GameMode {
  return {
    id: meta.name,
    name: meta.name,
    nameZh: meta.nameZh,
    description: body,
    descriptionZh: meta.descriptionZh ?? "",
    playerCount: meta.playerCount,
    roleDistribution: meta.roles as Role[],
    nightPhaseOrder: meta.nightPhaseOrder as NightPhase[],
    hasDeathTriggers: meta.hasDeathTriggers,
  };
}

/**
 * Lazily-built game modes from skills/modes/ markdown files.
 */
let _gameModes: Record<string, GameMode> | null = null;

function getGameModes(): Record<string, GameMode> {
  if (_gameModes) return _gameModes;

  const skills = loadModeSkills();
  const modes: Record<string, GameMode> = {};
  for (const [name, skill] of skills) {
    modes[name] = toGameMode(skill.meta, skill.body);
  }
  _gameModes = modes;
  return modes;
}

/**
 * GAME_MODES proxy — backward-compatible lazy accessor.
 */
export const GAME_MODES: Record<string, GameMode> = new Proxy(
  {} as Record<string, GameMode>,
  {
    get(_target, prop: string) {
      return getGameModes()[prop];
    },
    ownKeys() {
      return Object.keys(getGameModes());
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      const val = getGameModes()[prop];
      if (val === undefined) return undefined;
      return { configurable: true, enumerable: true, value: val };
    },
    has(_target, prop: string) {
      return prop in getGameModes();
    },
  }
);

export function getGameMode(modeId: string): GameMode {
  const mode = getGameModes()[modeId];
  if (!mode) throw new Error(`Unknown game mode: ${modeId}`);
  return mode;
}

export function getAllGameModes(): GameMode[] {
  return Object.values(getGameModes());
}
