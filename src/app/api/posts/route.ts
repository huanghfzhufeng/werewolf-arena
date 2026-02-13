import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentPosts, agents } from "@/db/schema";
import { eq, desc, isNull, sql } from "drizzle-orm";
import { createLogger } from "@/lib";

const log = createLogger("API:Posts");

/**
 * GET /api/posts — recent social posts with threaded replies.
 * Query params: limit (default 20)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

    // Fetch top-level posts (no parentId)
    const topPosts = await db
      .select({
        id: agentPosts.id,
        agentId: agentPosts.agentId,
        type: agentPosts.type,
        content: agentPosts.content,
        gameId: agentPosts.gameId,
        targetAgentId: agentPosts.targetAgentId,
        createdAt: agentPosts.createdAt,
        agentName: agents.name,
        agentAvatar: agents.avatar,
      })
      .from(agentPosts)
      .leftJoin(agents, eq(agentPosts.agentId, agents.id))
      .where(isNull(agentPosts.parentId))
      .orderBy(desc(agentPosts.createdAt))
      .limit(limit);

    // Fetch replies for these posts
    const postIds = topPosts.map((p) => p.id);
    const repliesMap: Map<string, typeof topPosts> = new Map();

    if (postIds.length > 0) {
      const replies = await db
        .select({
          id: agentPosts.id,
          agentId: agentPosts.agentId,
          type: agentPosts.type,
          content: agentPosts.content,
          gameId: agentPosts.gameId,
          targetAgentId: agentPosts.targetAgentId,
          parentId: agentPosts.parentId,
          createdAt: agentPosts.createdAt,
          agentName: agents.name,
          agentAvatar: agents.avatar,
        })
        .from(agentPosts)
        .leftJoin(agents, eq(agentPosts.agentId, agents.id))
        .where(sql`${agentPosts.parentId} IN (${sql.join(postIds.map((id) => sql`${id}`), sql`, `)})`)
        .orderBy(agentPosts.createdAt);

      for (const reply of replies) {
        const pid = reply.parentId!;
        if (!repliesMap.has(pid)) repliesMap.set(pid, []);
        repliesMap.get(pid)!.push(reply);
      }
    }

    // Get target agent names for impressions
    const targetIds = topPosts
      .filter((p) => p.targetAgentId)
      .map((p) => p.targetAgentId!);
    const targetNames: Map<string, { name: string; avatar: string }> = new Map();
    if (targetIds.length > 0) {
      const targets = await db
        .select({ id: agents.id, name: agents.name, avatar: agents.avatar })
        .from(agents)
        .where(sql`${agents.id} IN (${sql.join(targetIds.map((id) => sql`${id}`), sql`, `)})`);
      for (const t of targets) {
        targetNames.set(t.id, { name: t.name, avatar: t.avatar });
      }
    }

    // Build feed events
    const events = topPosts.map((post) => {
      const time = post.createdAt.toISOString();
      const replies = (repliesMap.get(post.id) ?? []).map((r) => ({
        id: r.id,
        kind: "agent_reply" as const,
        time: r.createdAt.toISOString(),
        agentName: r.agentName ?? "Agent",
        avatar: r.agentAvatar ?? "🎭",
        content: r.content,
        replyTo: post.agentName ?? "Agent",
      }));

      if (post.type === "reflection") {
        return {
          id: post.id,
          kind: "agent_reflection",
          time,
          agentName: post.agentName ?? "Agent",
          avatar: post.agentAvatar ?? "🎭",
          content: post.content,
          gameId: post.gameId,
          replies,
        };
      }

      if (post.type === "impression") {
        const target = post.targetAgentId
          ? targetNames.get(post.targetAgentId)
          : null;
        return {
          id: post.id,
          kind: "agent_impression",
          time,
          fromAgent: post.agentName ?? "Agent",
          fromAvatar: post.agentAvatar ?? "🎭",
          toAgent: target?.name ?? "Agent",
          toAvatar: target?.avatar ?? "🎭",
          content: post.content,
          gameId: post.gameId,
          replies,
        };
      }

      // Fallback for other types
      return {
        id: post.id,
        kind: "agent_reflection",
        time,
        agentName: post.agentName ?? "Agent",
        avatar: post.agentAvatar ?? "🎭",
        content: post.content,
        replies,
      };
    });

    return NextResponse.json({ success: true, posts: events });
  } catch (error) {
    log.error("Failed to fetch posts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}
