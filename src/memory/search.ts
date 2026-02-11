import { db } from "@/db";
import { agentMemories } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { MemorySearchResult } from "./types";

type SearchOpts = {
  /** Max results to return */
  limit?: number;
  /** Filter by memory source */
  source?: "reflection" | "game-transcript" | "social";
  /** Filter by game ID */
  gameId?: string;
};

/**
 * Search an agent's memories using PostgreSQL full-text search.
 * Results are ranked by a combination of relevance, importance, and recency.
 *
 * Falls back to a simple importance+recency query if no query is provided
 * or no FTS matches are found.
 */
export async function searchMemories(
  agentId: string,
  query?: string,
  opts: SearchOpts = {}
): Promise<MemorySearchResult[]> {
  const limit = opts.limit ?? 5;

  // If we have a query, try full-text search
  if (query && query.trim().length > 0) {
    const tsQuery = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(" & "); // AND-based matching for precision

    // Build WHERE conditions
    const conditions = [
      sql`${agentMemories.agentId} = ${agentId}`,
      sql`to_tsvector('simple', ${agentMemories.content}) @@ to_tsquery('simple', ${tsQuery})`,
    ];
    if (opts.source) conditions.push(sql`${agentMemories.source} = ${opts.source}`);
    if (opts.gameId) conditions.push(sql`${agentMemories.gameId} = ${opts.gameId}`);
    const whereClause = sql.join(conditions, sql` AND `);

    // Rank: FTS relevance × importance × recency decay
    const rankExpr = sql`ts_rank(to_tsvector('simple', ${agentMemories.content}), to_tsquery('simple', ${tsQuery})) * ${agentMemories.importance} * (1.0 / (1.0 + EXTRACT(EPOCH FROM now() - ${agentMemories.createdAt}) / 86400.0))`;

    const ftsResults = await db
      .select({
        id: agentMemories.id,
        content: agentMemories.content,
        source: agentMemories.source,
        importance: agentMemories.importance,
        createdAt: agentMemories.createdAt,
        rank: rankExpr,
      })
      .from(agentMemories)
      .where(whereClause)
      .orderBy(sql`${rankExpr} DESC`)
      .limit(limit);

    if (ftsResults.length > 0) {
      return ftsResults.map((r) => ({
        id: r.id,
        content: r.content,
        source: r.source,
        importance: r.importance,
        createdAt: r.createdAt,
      }));
    }
  }

  // Fallback: return most important + most recent memories
  const fallbackConditions = [sql`${agentMemories.agentId} = ${agentId}`];
  if (opts.source) fallbackConditions.push(sql`${agentMemories.source} = ${opts.source}`);
  if (opts.gameId) fallbackConditions.push(sql`${agentMemories.gameId} = ${opts.gameId}`);
  const baseConditions = fallbackConditions.length === 1
    ? eq(agentMemories.agentId, agentId)
    : sql.join(fallbackConditions, sql` AND `);

  const results = await db
    .select({
      id: agentMemories.id,
      content: agentMemories.content,
      source: agentMemories.source,
      importance: agentMemories.importance,
      createdAt: agentMemories.createdAt,
    })
    .from(agentMemories)
    .where(baseConditions)
    .orderBy(desc(agentMemories.importance), desc(agentMemories.createdAt))
    .limit(limit);

  return results;
}
