import { z } from "zod";

// ─── LLM Configuration ─────────────────────────────────────────

const LLMConfigSchema = z.object({
  apiUrl: z.string().default("https://api.deepseek.com/chat/completions"),
  model: z.string().default("deepseek-chat"),
  temperature: z.number().min(0).max(2).default(0.8),
  maxTokens: z.number().int().positive().default(300),
  maxRetries: z.number().int().min(0).default(2),
  retryBaseMs: z.number().int().positive().default(1000),
});

// ─── Game Timing (ms) ───────────────────────────────────────────

const TimingConfigSchema = z.object({
  phaseTransition: z.number().int().positive().default(3000),
  beforeSpeak: z.number().int().positive().default(1500),
  afterSpeak: z.number().int().positive().default(1000),
  beforeVote: z.number().int().positive().default(1000),
  voteRevealInterval: z.number().int().positive().default(800),
  deathAnnouncement: z.number().int().positive().default(2000),
  lastWords: z.number().int().positive().default(2000),
  gameOver: z.number().int().positive().default(3000),
});

// ─── Community / Lifecycle ──────────────────────────────────────

const CommunityConfigSchema = z.object({
  tickIntervalMs: z.number().int().positive().default(30_000),
  baseQueueChance: z.number().min(0).max(1).default(0.3),
  cooldownMinMs: z.number().int().positive().default(3 * 60 * 1000),
  cooldownMaxMs: z.number().int().positive().default(8 * 60 * 1000),
  eagerBonusThreshold: z.number().int().min(0).default(3),
  eagerBonusChance: z.number().min(0).max(1).default(0.2),
  experiencedGameThreshold: z.number().int().min(0).default(5),
  /** Mode weights for agents with fewer than experiencedGameThreshold games */
  defaultModeWeights: z
    .record(z.string(), z.number())
    .default({
      "classic-6p": 40,
      "standard-8p": 25,
      "advanced-12p": 10,
      "couples-9p": 15,
      "chaos-10p": 10,
    }),
  /** Mode weights for experienced agents */
  experiencedModeWeights: z
    .record(z.string(), z.number())
    .default({
      "classic-6p": 20,
      "standard-8p": 25,
      "advanced-12p": 20,
      "couples-9p": 15,
      "chaos-10p": 20,
    }),
});

// ─── Memory Configuration ────────────────────────────────────

const MemoryConfigSchema = z.object({
  /** Embedding provider: openai or disabled */
  embeddingProvider: z.enum(["openai", "disabled"]).default("disabled"),
  embeddingModel: z.string().default("text-embedding-3-small"),
  embeddingApiUrl: z.string().default("https://api.openai.com/v1/embeddings"),
  /** Max memories per agent before pruning */
  maxMemoriesPerAgent: z.number().int().positive().default(100),
  /** How many memories to inject into prompts */
  promptInjectionLimit: z.number().int().positive().default(5),
  /** Weight for FTS score in hybrid search (0-1) */
  ftsWeight: z.number().min(0).max(1).default(0.4),
  /** Weight for vector score in hybrid search (0-1) */
  vectorWeight: z.number().min(0).max(1).default(0.6),
});

// ─── Root Config ────────────────────────────────────────────

export const GameConfigSchema = z.object({
  llm: LLMConfigSchema.default(() => LLMConfigSchema.parse({})),
  timing: TimingConfigSchema.default(() => TimingConfigSchema.parse({})),
  community: CommunityConfigSchema.default(() => CommunityConfigSchema.parse({})),
  memory: MemoryConfigSchema.default(() => MemoryConfigSchema.parse({})),
});

export type GameConfig = z.infer<typeof GameConfigSchema>;
export type LLMConfig = z.infer<typeof LLMConfigSchema>;
export type TimingConfig = z.infer<typeof TimingConfigSchema>;
export type CommunityConfig = z.infer<typeof CommunityConfigSchema>;
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
