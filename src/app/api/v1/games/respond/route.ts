import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/auth";
import { getPendingTurn, resolvePendingTurn } from "@/agents/pending-turns";
import { resolvePlayerTarget } from "@/agents/agent-runner";
import { createLogger } from "@/lib";

const log = createLogger("API:v1:Respond");

/**
 * POST /api/v1/games/respond — Submit the agent's decision for the current turn
 *
 * Accepts the same response format as the webhook contract (play.md).
 */
export async function POST(request: Request) {
    try {
        const agent = await authenticateAgent(request);
        if (!agent) {
            return NextResponse.json(
                { error: "Unauthorized — provide Authorization: Bearer <api_key>" },
                { status: 401 }
            );
        }

        const pending = getPendingTurn(agent.id);
        if (!pending) {
            return NextResponse.json(
                { error: "No pending turn. You may have already responded or the turn timed out." },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { actionType, allPlayers, player } = pending;

        // Validate and parse the response based on action type
        const result = parseAgentResponse(body, actionType, allPlayers, player);
        if (result.error) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        // Resolve the pending turn — this unblocks the game loop
        const resolved = resolvePendingTurn(agent.id, result.value!);
        if (!resolved) {
            return NextResponse.json(
                { error: "Turn expired while processing response" },
                { status: 409 }
            );
        }

        log.info(`Agent ${agent.name} responded to ${actionType}`);
        return NextResponse.json({ accepted: true });
    } catch (error) {
        log.error("respond failed:", error);
        return NextResponse.json(
            { error: "Failed to process response" },
            { status: 500 }
        );
    }
}
import type { AgentTurnResult } from "@/agents/agent-runner";
import type { Player } from "@/db/schema";

type ParseResult =
    | { error: string; value?: undefined }
    | { error?: undefined; value: AgentTurnResult };

function parseAgentResponse(
    body: Record<string, unknown>,
    actionType: string,
    allPlayers: Player[],
    player: Player
): ParseResult {
    switch (actionType) {
        case "speak":
        case "speak_rebuttal":
        case "last_words": {
            const message = body.message as string | undefined;
            if (!message || typeof message !== "string" || message.trim().length === 0) {
                return { error: "message is required and must be a non-empty string" };
            }
            return { value: { message: message.slice(0, 500) } };
        }

        case "vote": {
            const target = body.target as string | undefined;
            if (!target || typeof target !== "string") {
                return { error: "target is required" };
            }
            const targetId = resolvePlayerTarget(target.slice(0, 50), allPlayers, player.id);
            if (!targetId) {
                return { error: `Could not find alive player matching "${target}"` };
            }
            return { value: { targetId } };
        }

        case "choose_kill_target": {
            const target = body.target as string | undefined;
            if (!target || typeof target !== "string") {
                return { error: "target is required" };
            }
            const targetId = resolvePlayerTarget(target.slice(0, 50), allPlayers, player.id);
            if (!targetId) {
                return { error: `Could not find alive player matching "${target}"` };
            }
            const message = body.message as string | undefined;
            return { value: { targetId, message: message?.slice(0, 500) } };
        }

        case "seer_check":
        case "guard_protect":
        case "hunter_shoot":
        case "wolf_king_revenge":
        case "enchant_target": {
            const target = body.target as string | undefined;
            if (!target || typeof target !== "string") {
                return { error: "target is required" };
            }
            const targetId = resolvePlayerTarget(target.slice(0, 50), allPlayers, player.id);
            if (!targetId) {
                return { error: `Could not find alive player matching "${target}"` };
            }
            return { value: { targetId } };
        }

        case "witch_decide": {
            const witchAction = body.witch_action as string | undefined;
            if (!witchAction || !["save", "poison", "none"].includes(witchAction)) {
                return { error: 'witch_action must be "save", "poison", or "none"' };
            }
            if (witchAction === "poison") {
                const target = body.target as string | undefined;
                if (!target || typeof target !== "string") {
                    return { error: "target is required when witch_action is poison" };
                }
                const targetId = resolvePlayerTarget(target.slice(0, 50), allPlayers, player.id);
                if (!targetId) {
                    return { error: `Could not find alive player matching "${target}"` };
                }
                return { value: { witchAction: "poison", targetId } };
            }
            return { value: { witchAction } };
        }

        case "cupid_link": {
            const target = body.target as string | undefined;
            const secondTarget = body.second_target as string | undefined;
            if (!target || !secondTarget) {
                return { error: "target and second_target are required" };
            }
            const targetId = resolvePlayerTarget(target.slice(0, 50), allPlayers);
            if (!targetId) {
                return { error: `Could not find alive player matching "${target}"` };
            }
            const secondTargetId = resolvePlayerTarget(secondTarget.slice(0, 50), allPlayers, targetId);
            if (!secondTargetId) {
                return { error: `Could not find alive player matching "${secondTarget}"` };
            }
            return { value: { targetId, secondTargetId } };
        }

        case "knight_speak": {
            const message = body.message as string | undefined;
            const flip = body.flip as boolean | undefined;
            const target = body.target as string | undefined;

            if (flip && target) {
                const targetId = resolvePlayerTarget(target.slice(0, 50), allPlayers, player.id);
                if (!targetId) {
                    return { error: `Could not find alive player matching "${target}"` };
                }
                return { value: { message: message?.slice(0, 500), knightCheck: true, targetId } };
            }
            if (!message || typeof message !== "string") {
                return { error: "message is required (or set flip=true with target)" };
            }
            return { value: { message: message.slice(0, 500) } };
        }

        case "dreamweaver_check": {
            const target = body.target as string | undefined;
            const secondTarget = body.second_target as string | undefined;
            if (!target || !secondTarget) {
                return { error: "target and second_target are required" };
            }
            const targetId = resolvePlayerTarget(target.slice(0, 50), allPlayers, player.id);
            if (!targetId) {
                return { error: `Could not find alive player matching "${target}"` };
            }
            const secondTargetId = resolvePlayerTarget(secondTarget.slice(0, 50), allPlayers, targetId);
            if (!secondTargetId) {
                return { error: `Could not find alive player matching "${secondTarget}"` };
            }
            return { value: { targetId, secondTargetId } };
        }

        default:
            return { error: `Unknown action type: ${actionType}` };
    }
}
