import fs from "fs";
import path from "path";
import matter from "gray-matter";
import {
  RoleFrontmatterSchema,
  ActionFrontmatterSchema,
  ModeFrontmatterSchema,
  NarratorFrontmatterSchema,
  type RoleSkill,
  type ActionSkill,
  type ModeSkill,
  type NarratorSkill,
} from "./types";
import { createLogger } from "@/lib";

const log = createLogger("Skills");

// ─── Resolve skills root ────────────────────────────────────────

function resolveSkillsDir(): string {
  // In Next.js, process.cwd() is the project root
  return path.join(process.cwd(), "skills");
}

// ─── Generic loader ─────────────────────────────────────────────

function loadSkillFiles(
  subdir: string,
  filename: string
): Array<{ filePath: string; frontmatter: Record<string, unknown>; body: string }> {
  const dir = path.join(resolveSkillsDir(), subdir);
  if (!fs.existsSync(dir)) {
    log.warn(`Directory not found: ${dir}`);
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: Array<{
    filePath: string;
    frontmatter: Record<string, unknown>;
    body: string;
  }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const filePath = path.join(dir, entry.name, filename);
    if (!fs.existsSync(filePath)) continue;

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = matter(raw);
      results.push({
        filePath,
        frontmatter: parsed.data as Record<string, unknown>,
        body: parsed.content.trim(),
      });
    } catch (err) {
      log.error(
        `Failed to parse ${filePath}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return results;
}

// ─── In-memory caches (process lifetime) ────────────────────────

let roleCache: Map<string, RoleSkill> | null = null;
let actionCache: Map<string, ActionSkill> | null = null;
let modeCache: Map<string, ModeSkill> | null = null;

// ─── Role skills ────────────────────────────────────────────────

export function loadRoleSkills(): Map<string, RoleSkill> {
  if (roleCache) return roleCache;

  const cache = new Map<string, RoleSkill>();
  const files = loadSkillFiles("roles", "ROLE.md");

  for (const { filePath, frontmatter, body } of files) {
    const parsed = RoleFrontmatterSchema.safeParse(frontmatter);
    if (!parsed.success) {
      log.error(
        `Invalid ROLE.md frontmatter in ${filePath}:`,
        parsed.error.issues.map((i) => i.message).join(", ")
      );
      continue;
    }
    cache.set(parsed.data.name, { meta: parsed.data, body, filePath });
  }

  log.info(`Loaded ${cache.size} role skills: ${[...cache.keys()].join(", ")}`);
  roleCache = cache;
  return cache;
}

export function getRoleSkill(roleId: string): RoleSkill | undefined {
  return loadRoleSkills().get(roleId);
}

// ─── Action skills ──────────────────────────────────────────────

export function loadActionSkills(): Map<string, ActionSkill> {
  if (actionCache) return actionCache;

  const cache = new Map<string, ActionSkill>();
  const files = loadSkillFiles("actions", "ACTION.md");

  for (const { filePath, frontmatter, body } of files) {
    const parsed = ActionFrontmatterSchema.safeParse(frontmatter);
    if (!parsed.success) {
      log.error(
        `Invalid ACTION.md frontmatter in ${filePath}:`,
        parsed.error.issues.map((i) => i.message).join(", ")
      );
      continue;
    }
    cache.set(parsed.data.name, { meta: parsed.data, body, filePath });
  }

  log.info(`Loaded ${cache.size} action skills: ${[...cache.keys()].join(", ")}`);
  actionCache = cache;
  return cache;
}

export function getActionSkill(actionName: string): ActionSkill | undefined {
  return loadActionSkills().get(actionName);
}

// ─── Mode skills ────────────────────────────────────────────────

export function loadModeSkills(): Map<string, ModeSkill> {
  if (modeCache) return modeCache;

  const cache = new Map<string, ModeSkill>();
  const files = loadSkillFiles("modes", "MODE.md");

  for (const { filePath, frontmatter, body } of files) {
    const parsed = ModeFrontmatterSchema.safeParse(frontmatter);
    if (!parsed.success) {
      log.error(
        `Invalid MODE.md frontmatter in ${filePath}:`,
        parsed.error.issues.map((i) => i.message).join(", ")
      );
      continue;
    }
    cache.set(parsed.data.name, { meta: parsed.data, body, filePath });
  }

  log.info(`Loaded ${cache.size} mode skills: ${[...cache.keys()].join(", ")}`);
  modeCache = cache;
  return cache;
}

export function getModeSkill(modeId: string): ModeSkill | undefined {
  return loadModeSkills().get(modeId);
}

// ─── Narrator skills ────────────────────────────────────────────

let narratorCache: Map<string, NarratorSkill> | null = null;

export function loadNarratorSkills(): Map<string, NarratorSkill> {
  if (narratorCache) return narratorCache;

  const cache = new Map<string, NarratorSkill>();
  const files = loadSkillFiles("narrators", "NARRATOR.md");

  for (const { filePath, frontmatter, body } of files) {
    const parsed = NarratorFrontmatterSchema.safeParse(frontmatter);
    if (!parsed.success) {
      log.error(
        `Invalid NARRATOR.md frontmatter in ${filePath}:`,
        parsed.error.issues.map((i) => i.message).join(", ")
      );
      continue;
    }
    cache.set(parsed.data.name, { meta: parsed.data, body, filePath });
  }

  log.info(`Loaded ${cache.size} narrator skill(s): ${[...cache.keys()].join(", ")}`);
  narratorCache = cache;
  return cache;
}

export function getNarratorSkill(name: string): NarratorSkill | undefined {
  return loadNarratorSkills().get(name);
}

// ─── Cache control ──────────────────────────────────────────────

/** Clear all caches (useful for testing or hot reload) */
export function clearSkillCaches(): void {
  roleCache = null;
  actionCache = null;
  modeCache = null;
  narratorCache = null;
}
