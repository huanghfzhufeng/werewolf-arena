import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/auth";
import { getPendingTurn } from "@/agents/pending-turns";
import { isWerewolfTeam } from "@/engine/roles";
import type { Role } from "@/engine/roles";
import { createLogger } from "@/lib";

const log = createLogger("API:v1:MyTurn");

/**
 * GET /api/v1/games/my-turn — Check if it's the agent's turn
 *
 * Returns game state if the agent has a pending turn, or { has_turn: false } otherwise.
 * This is the polling counterpart to the webhook system.
 */
export async function GET(request: Request) {
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
            return NextResponse.json({ has_turn: false });
        }

        const { gameId, round, phase, actionType, player, allPlayers, chatHistory, knownInfo, extraContext } = pending;

        // Build safe player lists (hide roles from non-wolves)
        const alivePlayers = allPlayers
            .filter((p) => p.isAlive)
            .map((p) => ({ name: p.agentName, seat: p.seatNumber }));

        const deadPlayers = allPlayers
            .filter((p) => !p.isAlive)
            .map((p) => ({ name: p.agentName, seat: p.seatNumber }));

        // Build known info specific to the player's role
        const yourRole = player.role as string;

        // Wolf team awareness: reveal teammates to wolves
        let teammates: { name: string; seat: number; role: string }[] | undefined;
        if (yourRole && isWerewolfTeam(yourRole as Role) && yourRole !== "madman") {
            teammates = allPlayers
                .filter(
                    (p) =>
                        p.id !== player.id &&
                        p.role &&
                        isWerewolfTeam(p.role as Role) &&
                        p.role !== "madman"
                )
                .map((p) => ({
                    name: p.agentName,
                    seat: p.seatNumber,
                    role: p.role as string,
                }));
        }

        // Build chat history for the response
        const chatHistoryFormatted = chatHistory.map((m) => ({
            speaker: m.isSystem
                ? "【系统】"
                : allPlayers.find((p) => p.id === m.playerId)?.agentName ?? "未知",
            content: m.content,
        }));

        // Build extra context for specific actions
        const extraContextSafe: Record<string, unknown> = {};
        if (actionType === "witch_decide" && extraContext) {
            const wolfVictim = extraContext.wolfVictimName
                ? allPlayers.find((p) => p.agentName === extraContext.wolfVictimName)
                : null;
            extraContextSafe.wolf_victim = wolfVictim ? wolfVictim.agentName : null;
            extraContextSafe.has_save_potion = extraContext.hasSavePotion ?? false;
            extraContextSafe.has_poison_potion = extraContext.hasPoisonPotion ?? false;
        }
        if (actionType === "guard_protect" && extraContext?.lastProtectedId) {
            const lastProtected = allPlayers.find(
                (p) => p.id === extraContext.lastProtectedId
            );
            extraContextSafe.last_protected = lastProtected?.agentName ?? null;
        }

        return NextResponse.json({
            has_turn: true,
            game_state: {
                game_id: gameId,
                round,
                phase,
                action_type: actionType,
                your_role: yourRole,
                your_seat: player.seatNumber,
                alive_players: alivePlayers,
                dead_players: deadPlayers,
                chat_history: chatHistoryFormatted,
                known_info: knownInfo,
                extra_context: Object.keys(extraContextSafe).length > 0 ? extraContextSafe : undefined,
                teammates,
            },
        });
    } catch (error) {
        log.error("my-turn check failed:", error);
        return NextResponse.json(
            { error: "Failed to check turn status" },
            { status: 500 }
        );
    }
}
