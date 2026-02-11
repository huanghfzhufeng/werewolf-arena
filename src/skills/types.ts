import { z } from "zod";

// ─── Role Skill ─────────────────────────────────────────────────

export const RoleFrontmatterSchema = z.object({
  name: z.string(),
  nameZh: z.string(),
  team: z.enum(["werewolf", "villager"]),
  hasNightAction: z.boolean(),
  nightPhase: z.string().nullable(),
  nightPriority: z.number(),
  deathTrigger: z.string().nullable(),
  descriptionZh: z.string(),
  // Phase 6: event declarations (optional for now)
  listensTo: z.array(z.string()).optional(),
  emits: z.array(z.string()).optional(),
  requires: z
    .object({ context: z.array(z.string()) })
    .optional(),
});

export type RoleFrontmatter = z.infer<typeof RoleFrontmatterSchema>;

export type RoleSkill = {
  /** Parsed frontmatter metadata */
  meta: RoleFrontmatter;
  /** Markdown body — LLM prompt text */
  body: string;
  /** Absolute file path */
  filePath: string;
};

// ─── Action Skill ───────────────────────────────────────────────

export const ActionFrontmatterSchema = z.object({
  name: z.string(),
  requiresPhase: z.string().nullable(),
  responseFormat: z.string().optional(),
  provides: z.array(z.string()).optional(),
  listensTo: z.array(z.string()).optional(),
  requires: z
    .object({ context: z.array(z.string()) })
    .optional(),
});

export type ActionFrontmatter = z.infer<typeof ActionFrontmatterSchema>;

export type ActionSkill = {
  meta: ActionFrontmatter;
  body: string;
  filePath: string;
};

// ─── Narrator Skill ─────────────────────────────────────────────

export const NarratorFrontmatterSchema = z.object({
  name: z.string(),
  nameZh: z.string(),
  style: z.string(),
  tone: z.string(),
  narratesPhases: z.array(z.string()),
  descriptionZh: z.string(),
});

export type NarratorFrontmatter = z.infer<typeof NarratorFrontmatterSchema>;

export type NarratorSkill = {
  meta: NarratorFrontmatter;
  /** Markdown body — system prompt for the narrator LLM */
  body: string;
  filePath: string;
};

// ─── Mode Skill ─────────────────────────────────────────────────

export const ModeFrontmatterSchema = z.object({
  name: z.string(),
  nameZh: z.string(),
  playerCount: z.number(),
  roles: z.array(z.string()),
  nightPhaseOrder: z.array(z.string()),
  hasDeathTriggers: z.boolean(),
  descriptionZh: z.string().optional(),
});

export type ModeFrontmatter = z.infer<typeof ModeFrontmatterSchema>;

export type ModeSkill = {
  meta: ModeFrontmatter;
  body: string;
  filePath: string;
};
