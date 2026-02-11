"use client";
import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useGameStream } from "@/hooks/useGameStream";
import type { GameEvent } from "@/engine/events";
import { Film } from "lucide-react";
import { MODE_LABELS } from "../../constants";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { PlayerSidebar } from "@/components/game/PlayerSidebar";
import { PhaseIndicator } from "@/components/game/PhaseIndicator";
import { GameOverBanner } from "@/components/game/GameOverBanner";
import { ChatFeed } from "@/components/game/ChatFeed";
import type { GameState, PlayerInfo, FeedItem } from "@/components/game/types";
import { parsePersonality } from "@/components/game/types";
import { useReplay } from "@/hooks/useReplay";
import { ReplayControls } from "@/components/game/ReplayControls";

export default function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: gameId } = use(params);
  const [game, setGame] = useState<GameState | null>(null);
  const [playerList, setPlayerList] = useState<PlayerInfo[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [thinkingPlayer, setThinkingPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replayMode, setReplayMode] = useState(false);

  useEffect(() => {
    fetch(`/api/games/${gameId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setGame(data.game);
          setPlayerList(
            (data.players as PlayerInfo[]).map((p) => ({
              ...p,
              parsedPersonality: parsePersonality(p.personality),
            })),
          );
          const items: FeedItem[] = (data.messages ?? []).map(
            (m: { id: string; playerId?: string; content: string; isPrivate: boolean; isSystem: boolean; round: number; createdAt: string }) => ({
              id: m.id,
              kind: m.isSystem ? "system" as const : "message" as const,
              playerId: m.playerId ?? undefined,
              content: m.content,
              isPrivate: m.isPrivate,
              round: m.round,
              timestamp: m.createdAt,
            }),
          );
          setFeed(items);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [gameId]);

  const handleEvent = useCallback((event: GameEvent) => {
    switch (event.type) {
      case "phase_change":
        setGame((g) => g ? { ...g, currentPhase: event.data.phase as string, currentRound: event.data.round as number } : g);
        setThinkingPlayer(null);
        break;
      case "night_fall":
      case "day_break":
        setFeed((prev) => [...prev, { id: crypto.randomUUID(), kind: "atmosphere", content: event.data.description as string, round: event.round, timestamp: event.timestamp }]);
        break;
      case "thinking":
        setThinkingPlayer(event.data.playerId as string);
        break;
      case "message":
        setThinkingPlayer(null);
        setFeed((prev) => [...prev, { id: crypto.randomUUID(), kind: (event.data.isSystem as boolean) ? "system" : "message", playerId: event.data.playerId as string | undefined, content: event.data.content as string, isPrivate: (event.data.isPrivate as boolean) ?? false, round: event.round, timestamp: event.timestamp }]);
        break;
      case "vote":
        setFeed((prev) => [...prev, { id: crypto.randomUUID(), kind: "vote", playerId: event.data.voterId as string, content: `投给了 ${event.data.targetName as string}`, round: event.round, timestamp: event.timestamp, extra: { targetId: event.data.targetId, targetName: event.data.targetName, reason: event.data.reason } }]);
        break;
      case "last_words":
        setThinkingPlayer(null);
        setFeed((prev) => [...prev, { id: crypto.randomUUID(), kind: "last_words", playerId: event.data.playerId as string, content: event.data.content as string, round: event.round, timestamp: event.timestamp }]);
        break;
      case "seer_result":
        setFeed((prev) => [...prev, { id: crypto.randomUUID(), kind: "seer_result", playerId: event.data.seerId as string, content: `查验了 ${event.data.targetName as string}，结果是：${(event.data.result as string) === "werewolf" ? "🐺 狼人" : "👤 好人"}`, round: event.round, timestamp: event.timestamp }]);
        break;
      case "vote_tally":
        setFeed((prev) => [...prev, { id: crypto.randomUUID(), kind: "vote_tally", content: "", round: event.round, timestamp: event.timestamp, extra: { tally: event.data.tally } }]);
        break;
      case "death":
        setPlayerList((prev) => prev.map((p) => p.id === event.data.playerId ? { ...p, isAlive: false } : p));
        break;
      case "role_reveal": {
        const revealed = event.data.players as Array<{ id: string; role: string; alive: boolean }>;
        setPlayerList((prev) => prev.map((p) => { const r = revealed.find((rp) => rp.id === p.id); return r ? { ...p, role: r.role, isAlive: r.alive } : p; }));
        break;
      }
      case "witch_action":
        setFeed((prev) => [...prev, { id: crypto.randomUUID(), kind: "system", content: event.data.description as string, isPrivate: true, round: event.round, timestamp: event.timestamp }]);
        break;
      case "hunter_shoot":
        setFeed((prev) => [...prev, { id: crypto.randomUUID(), kind: "system", content: `🔫 ${event.data.hunterName as string} 发动了猎人技能，带走了 ${event.data.targetName as string}！`, round: event.round, timestamp: event.timestamp }]);
        if (event.data.targetId) setPlayerList((prev) => prev.map((p) => p.id === event.data.targetId ? { ...p, isAlive: false } : p));
        break;
      case "wolf_king_revenge":
        setFeed((prev) => [...prev, { id: crypto.randomUUID(), kind: "system", content: `👑 ${event.data.wolfKingName as string} 发动了狼王复仇，带走了 ${event.data.targetName as string}！`, round: event.round, timestamp: event.timestamp }]);
        if (event.data.targetId) setPlayerList((prev) => prev.map((p) => p.id === event.data.targetId ? { ...p, isAlive: false } : p));
        break;
      case "game_over":
        setGame((g) => g ? { ...g, status: "finished", currentPhase: "game_over", winner: event.data.winner as string } : g);
        break;
    }
  }, []);

  useGameStream(gameId, handleEvent);

  // Replay for finished games
  const replay = useReplay(gameId, replayMode);
  const activeFeed = replayMode ? replay.visibleItems : feed;

  const handleStart = async () => {
    await fetch(`/api/games/${gameId}`, { method: "POST" });
  };

  if (loading) return <LoadingSkeleton variant="list" />;

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 text-center">
          <div className="text-2xl mb-2">❌</div>
          <div className="text-lg font-semibold text-wolf">游戏不存在</div>
        </div>
      </div>
    );
  }

  const isNight = game.currentPhase.startsWith("night");

  return (
    <div
      className={`min-h-screen transition-all duration-1000 relative overflow-hidden ${
        isNight ? "theme-night" : "theme-day"
      }`}
      style={{
        background: isNight
          ? "linear-gradient(180deg, #0c1220 0%, #111827 40%, #0f1d32 100%)"
          : undefined,
      }}
    >
      {/* Moonlight glow effect */}
      {isNight && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-20 right-10 w-40 h-40 rounded-full opacity-15 blur-3xl"
            style={{ background: "radial-gradient(circle, #93c5fd 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-4 right-16 w-10 h-10 rounded-full opacity-50"
            style={{ background: "radial-gradient(circle, #fef9c3 0%, #fde68a 40%, transparent 70%)", boxShadow: "0 0 30px 10px rgba(254, 249, 195, 0.1)" }}
          />
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 rounded-full bg-white/20 animate-pulse"
              style={{
                top: `${10 + (i * 37) % 30}%`,
                left: `${5 + (i * 53) % 90}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${2.5 + (i % 3)}s`,
              }}
            />
          ))}
        </div>
      )}
      <div className="max-w-5xl mx-auto p-4 md:p-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors">
            ← 返回
          </Link>
          <div className="text-center">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              🐺 狼人杀 Arena
            </h1>
            {game.modeId && (
              <div className="text-xs text-text-muted mt-0.5">{MODE_LABELS[game.modeId] ?? game.modeId}</div>
            )}
          </div>
          <div className="text-sm font-semibold px-3 py-1 rounded-lg border border-border tabular-nums">
            第 {game.currentRound} 轮
          </div>
        </div>

        <PhaseIndicator phase={game.currentPhase} isNight={isNight} />

        {game.status === "lobby" && (
          <div className="text-center mb-8">
            <button
              onClick={handleStart}
              className="px-8 py-3 bg-villager text-white text-lg font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              🎮 开始游戏
            </button>
          </div>
        )}

        {game.winner && <GameOverBanner winner={game.winner} players={playerList} />}

        {/* Replay controls for finished games */}
        {game.status === "finished" && !replayMode && (
          <div className="text-center mb-4">
            <button
              onClick={() => setReplayMode(true)}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface-hover transition-colors"
            >
              <Film size={14} /> 🎬 回放对局
            </button>
          </div>
        )}
        {replayMode && !replay.loading && (
          <ReplayControls
            isPlaying={replay.isPlaying}
            speed={replay.speed}
            progress={replay.progress}
            current={replay.current}
            total={replay.total}
            onToggle={replay.toggle}
            onSetSpeed={replay.setSpeed}
            onSeek={replay.seekTo}
            onReset={replay.reset}
            onExit={() => setReplayMode(false)}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <PlayerSidebar players={playerList} thinkingPlayerId={replayMode ? null : thinkingPlayer} />
          <ChatFeed
            feed={activeFeed}
            players={playerList}
            thinkingPlayerId={replayMode ? null : thinkingPlayer}
          />
        </div>
      </div>
    </div>
  );
}
