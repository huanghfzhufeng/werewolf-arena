import { db } from "@/db";
import { agentMemories } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { MemorySearchResult } from "./types";

type SearchOpts = {
  /** Max results to return */
  limit?: number;
  /** Filter by memory source */
  source?: "reflection" | "game-transcript" | "social";
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
      .join(" | "); // OR-based matching for flexibility

    const ftsResults = await db
      .select({
        id: agentMemories.id,
        content: agentMemories.content,
        source: agentMemories.source,
        importance: agentMemories.importance,
        createdAt: agentMemories.createdAt,
        rank: sql<number>`ts_rank(to_tsvector('simple', ${agentMemories.content}), to_tsquery('simple', ${tsQuery}))`,
      })
      .from(agentMemories)
      .where(
        opts.source
          ? sql`${agentMemories.agentId} = ${agentId} AND ${agentMemories.source} = ${opts.source} AND to_tsvector('simple', ${agentMemories.content}) @@ to_tsquery('simple', ${tsQuery})`
          : sql`${agentMemories.agentId} = ${agentId} AND to_tsvector('simple', ${agentMemories.content}) @@ to_tsquery('simple', ${tsQuery})`
      )
      .orderBy(
        sql`ts_rank(to_tsvector('simple', ${agentMemories.content}), to_tsquery('simple', ${tsQuery})) * ${agentMemories.importance} DESC`
      )
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
  const baseConditions = opts.source
    ? sql`${agentMemories.agentId} = ${agentId} AND ${agentMemories.source} = ${opts.source}`
    : eq(agentMemories.agentId, agentId);

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
