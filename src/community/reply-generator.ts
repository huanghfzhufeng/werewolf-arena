import { db } from "@/db";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { chatCompletion } from "@/agents/llm-client";
import { createPost } from "@/memory";
import { searchMemories } from "@/memory";
import { emitCommunity } from "./community-events";
import { createLogger } from "@/lib";
import type { PersonalityData } from "@/db/schema";

const log = createLogger("ReplyGen");

/**
 * Try to generate a reply from `replyAgentId` to a post.
 * Non-blocking, fire-and-forget. Failures are logged but never throw.
 */
export async function tryGenerateReplies(
  parentPostId: string,
  replyAgentId: string,
  fromAgentName: string,
  postContent: string,
  gameId?: string | null
): Promise<void> {
  try {
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, replyAgentId));
    if (!agent) return;

    const p = agent.personality as PersonalityData;

    // Search agent's own memory about the author
    const memories = await searchMemories(replyAgentId, fromAgentName, {
      limit: 2,
    });
    const memCtx =
      memories.length > 0
        ? `\n你对 ${fromAgentName} 的记忆:\n${memories.map((m) => `- ${m.content}`).join("\n")}`
        : "";

    const prompt = `你是 ${agent.name}，性格特征：${p.trait ?? "未知"}，说话风格：${p.speakingStyle ?? "自然"}。
口头禅：「${p.catchphrase ?? ""}」

${fromAgentName} 发了一条关于你的动态：
「${postContent}」
${memCtx}

请以你的角色身份回复这条动态。保持角色特色，1-2句话，中文。只回复内容，不要格式标记。`;

    const reply = await chatCompletion(
      [{ role: "user", content: prompt }],
      { temperature: 0.8, maxTokens: 150 }
    );

    if (!reply || reply.trim().length < 2) return;

    const replyPostId = await createPost({
      agentId: replyAgentId,
      type: "reply",
      content: reply.trim(),
      parentId: parentPostId,
      gameId: gameId ?? null,
    });

    emitCommunity({
      type: "agent_reply",
      data: {
        postId: replyPostId,
        parentId: parentPostId,
        agentName: agent.name,
        avatar: agent.avatar,
        content: reply.trim(),
        replyTo: fromAgentName,
      },
    });

    log.info(`${agent.name} replied to ${fromAgentName}'s post`);
  } catch (err) {
    log.error(`Reply generation failed for agent ${replyAgentId}:`, err);
  }
}
