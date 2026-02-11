import { db } from "@/db";
import { agentMemories } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { loadConfig } from "@/config";
import { generateEmbedding } from "./embeddings";
import type { MemorySearchResult } from "./types";
import { createLogger } from "@/lib";

const log = createLogger("MemorySearch");

type SearchOpts = {
  /** Max results to return */
  limit?: number;
  /** Filter by memory source */
  source?: "reflection" | "game-transcript" | "social" | "self-note";
  /** Filter by game ID */
  gameId?: string;
};

/**
 * Hybrid search: FTS + pgvector with configurable weighted fusion.
 * Gracefully degrades:
 *   - No embedding → FTS only
 *   - No FTS match → vector only
 *   - Neither → importance + recency fallback
 */
export async function searchMemories(
  agentId: string,
  query?: string,
  opts: SearchOpts = {}
): Promise<MemorySearchResult[]> {
  const limit = opts.limit ?? 5;
  const cfg = loadConfig().memory;

  if (!query || query.trim().length === 0) {
    return fallbackSearch(agentId, opts, limit);
  }

  // ── FTS search ──
  const ftsResults = await ftsSearch(agentId, query, opts, limit * 2);

  // ── Vector search (if embedding is enabled) ──
  const vecResults = await vectorSearch(agentId, query, opts, limit * 2);

  // ── Fusion ──
  if (ftsResults.length === 0 && vecResults.length === 0) {
    return fallbackSearch(agentId, opts, limit);
  }

  if (vecResults.length === 0) {
    // FTS only
    return ftsResults.slice(0, limit);
  }
  if (ftsResults.length === 0) {
    // Vector only
    return vecResults.slice(0, limit);
  }

  // Weighted reciprocal rank fusion
  const scoreMap = new Map<string, { score: number; result: MemorySearchResult }>();
  const wFts = cfg.ftsWeight;
  const wVec = cfg.vectorWeight;

  ftsResults.forEach((r, idx) => {
    const rrf = wFts / (idx + 1);
    scoreMap.set(r.id, { score: rrf, result: r });
  });
  vecResults.forEach((r, idx) => {
    const rrf = wVec / (idx + 1);
    const existing = scoreMap.get(r.id);
    if (existing) {
      existing.score += rrf;
    } else {
      scoreMap.set(r.id, { score: rrf, result: r });
    }
  });

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ result, score }) => ({ ...result, score }));
}

// ─── FTS (full-text search) ──────────────────────────────────

async function ftsSearch(
  agentId: string,
  query: string,
  opts: SearchOpts,
  limit: number
): Promise<MemorySearchResult[]> {
  try {
    const tsQuery = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(" | "); // OR-based for recall

    const conditions = [
      sql`${agentMemories.agentId} = ${agentId}`,
      sql`to_tsvector('simple', ${agentMemories.content}) @@ to_tsquery('simple', ${tsQuery})`,
    ];
    if (opts.source) conditions.push(sql`${agentMemories.source} = ${opts.source}`);
    if (opts.gameId) conditions.push(sql`${agentMemories.gameId} = ${opts.gameId}`);

    const rankExpr = sql`ts_rank(to_tsvector('simple', ${agentMemories.content}), to_tsquery('simple', ${tsQuery})) * ${agentMemories.importance} * (1.0 / (1.0 + EXTRACT(EPOCH FROM now() - ${agentMemories.createdAt}) / 86400.0))`;

    const rows = await db
      .select({
        id: agentMemories.id,
        content: agentMemories.content,
        source: agentMemories.source,
        importance: agentMemories.importance,
        createdAt: agentMemories.createdAt,
      })
      .from(agentMemories)
      .where(sql.join(conditions, sql` AND `))
      .orderBy(sql`${rankExpr} DESC`)
      .limit(limit);

    return rows;
  } catch (err) {
    log.warn("FTS search failed, skipping:", err);
    return [];
  }
}

// ─── Vector search (pgvector) ────────────────────────────────

async function vectorSearch(
  agentId: string,
  query: string,
  opts: SearchOpts,
  limit: number
): Promise<MemorySearchResult[]> {
  try {
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) return [];

    const vecLiteral = `[${queryEmbedding.join(",")}]`;

    const conditions = [
      sql`${agentMemories.agentId} = ${agentId}`,
      sql`${agentMemories.embedding} IS NOT NULL`,
    ];
    if (opts.source) conditions.push(sql`${agentMemories.source} = ${opts.source}`);
    if (opts.gameId) conditions.push(sql`${agentMemories.gameId} = ${opts.gameId}`);

    // Cosine distance: 1 - (a <=> b) gives similarity
    const rows = await db
      .select({
        id: agentMemories.id,
        content: agentMemories.content,
        source: agentMemories.source,
        importance: agentMemories.importance,
        createdAt: agentMemories.createdAt,
      })
      .from(agentMemories)
      .where(sql.join(conditions, sql` AND `))
      .orderBy(sql`${agentMemories.embedding} <=> ${vecLiteral}::vector`)
      .limit(limit);

    return rows;
  } catch (err) {
    log.warn("Vector search failed, degrading:", err);
    return [];
  }
}

// ─── Fallback: importance + recency ──────────────────────────

async function fallbackSearch(
  agentId: string,
  opts: SearchOpts,
  limit: number
): Promise<MemorySearchResult[]> {
  const conditions = [sql`${agentMemories.agentId} = ${agentId}`];
  if (opts.source) conditions.push(sql`${agentMemories.source} = ${opts.source}`);
  if (opts.gameId) conditions.push(sql`${agentMemories.gameId} = ${opts.gameId}`);

  return db
    .select({
      id: agentMemories.id,
      content: agentMemories.content,
      source: agentMemories.source,
      importance: agentMemories.importance,
      createdAt: agentMemories.createdAt,
    })
    .from(agentMemories)
    .where(conditions.length === 1 ? eq(agentMemories.agentId, agentId) : sql.join(conditions, sql` AND `))
    .orderBy(desc(agentMemories.importance), desc(agentMemories.createdAt))
    .limit(limit);
}
