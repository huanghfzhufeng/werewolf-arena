import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { authenticateAgent } from "@/lib/auth";
import { db } from "@/db";
import { games, players, messages, actions, votes } from "@/db/schema";
import type { Player } from "@/db/schema";
import { ROLE_CONFIGS } from "@/engine/roles";
import type { Role } from "@/engine/roles";
import { createLogger } from "@/lib";

const log = createLogger("API:v1:GameTranscript");

/**
 * GET /api/v1/games/[gameId]/transcript — Export a game transcript for local memory storage.
 *
 * Returns a structured summary of the game for the authenticated agent, including:
 * - Game outcome (win/loss)
 * - Agent's role
 * - All players and their roles (revealed post-game)
 * - Chat history
 * - Actions taken
 * - Voting records
 *
 * Only available for finished games that the agent participated in.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ gameId: string }> }
) {
    try {
        const agent = await authenticateAgent(request);
        if (!agent) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { gameId } = await params;

        // Verify the game exists and is finished
        const [game] = await db
            .select()
            .from(games)
            .where(eq(games.id, gameId));

        if (!game) {
            return NextResponse.json({ error: "Game not found" }, { status: 404 });
        }
        if (game.status !== "finished") {
            return NextResponse.json(
                { error: "Game is still in progress" },
                { status: 400 }
            );
        }

        // Verify the agent participated in this game
        const allPlayers = await db
            .select()
            .from(players)
            .where(eq(players.gameId, gameId));

        const myPlayer = allPlayers.find((p) => p.agentId === agent.id);
        if (!myPlayer) {
            return NextResponse.json(
                { error: "You did not participate in this game" },
                { status: 403 }
            );
        }

        // Fetch chat history
        const chatHistory = await db
            .select()
            .from(messages)
            .where(eq(messages.gameId, gameId))
            .orderBy(messages.round, messages.createdAt);

        // Fetch actions
        const gameActions = await db
            .select()
            .from(actions)
            .where(eq(actions.gameId, gameId))
            .orderBy(actions.round, actions.createdAt);

        // Fetch votes
        const gameVotes = await db
            .select()
            .from(votes)
            .where(eq(votes.gameId, gameId))
            .orderBy(votes.round, votes.createdAt);

        // Build player name map
        const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

        const myRole = (myPlayer.role ?? "villager") as Role;
        const myRoleConfig = ROLE_CONFIGS[myRole];
        const won = myRoleConfig.team === game.winner;

        // Format the transcript
        const transcript = {
            game_id: gameId,
            mode: game.modeId,
            result: won ? "win" : "loss",
            winner: game.winner,
            your_role: myRole,
            your_role_name: myRoleConfig.nameZh,
            rounds: game.currentRound,
            finished_at: game.finishedAt?.toISOString(),

            // All players with roles revealed
            players: allPlayers.map((p) => {
                const role = (p.role ?? "villager") as Role;
                return {
                    name: p.agentName,
                    seat: p.seatNumber,
                    role,
                    role_name: ROLE_CONFIGS[role].nameZh,
                    survived: p.isAlive,
                    is_you: p.id === myPlayer.id,
                };
            }),

            // Chat log grouped by round
            chat: chatHistory.map((m) => ({
                round: m.round,
                phase: m.phase,
                speaker: m.isSystem
                    ? "【系统】"
                    : playerMap.get(m.playerId ?? "")?.agentName ?? "未知",
                content: m.content,
                is_system: m.isSystem,
            })),

            // Night actions involving you (visible post-game)
            actions: gameActions
                .filter((a) => a.playerId === myPlayer.id || playerMap.get(a.targetId)?.id === myPlayer.id)
                .map((a) => ({
                    round: a.round,
                    type: a.actionType,
                    actor: playerMap.get(a.playerId)?.agentName ?? "未知",
                    target: playerMap.get(a.targetId)?.agentName ?? "未知",
                    result: a.result,
                })),

            // All votes (public info)
            votes: gameVotes.map((v) => ({
                round: v.round,
                phase: v.phase,
                voter: playerMap.get(v.voterId)?.agentName ?? "未知",
                target: playerMap.get(v.targetId)?.agentName ?? "未知",
            })),
        };

        return NextResponse.json(transcript);
    } catch (error) {
        log.error("transcript export failed:", error);
        return NextResponse.json(
            { error: "Failed to export transcript" },
            { status: 500 }
        );
    }
}
