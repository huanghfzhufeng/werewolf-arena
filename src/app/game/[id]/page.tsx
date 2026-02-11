"use client";
import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useGameStream } from "@/hooks/useGameStream";
import type { GameEvent } from "@/engine/events";
import { Wifi, WifiOff } from "lucide-react";
import { WOBBLY, WOBBLY_SM } from "../../design";
import { MODE_LABELS } from "../../constants";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { PlayerSidebar } from "@/components/game/PlayerSidebar";
import { PhaseIndicator } from "@/components/game/PhaseIndicator";
import { GameOverBanner } from "@/components/game/GameOverBanner";
import { ChatFeed } from "@/components/game/ChatFeed";
import type { GameState, PlayerInfo, FeedItem } from "@/components/game/types";
import { parsePersonality } from "@/components/game/types";

export default function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: gameId } = use(params);
  const [game, setGame] = useState<GameState | null>(null);
  const [playerList, setPlayerList] = useState<PlayerInfo[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [showPrivate, setShowPrivate] = useState(false);
  const [showGodView, setShowGodView] = useState(false);
  const [thinkingPlayer, setThinkingPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const { connected, reconnecting } = useGameStream(gameId, handleEvent);

  const handleStart = async () => {
    await fetch(`/api/games/${gameId}`, { method: "POST" });
  };

  if (loading) return <LoadingSkeleton variant="list" />;

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="border-[3px] border-accent bg-white p-8 text-center wobbly shadow-hand">
          <div className="text-2xl mb-2">❌</div>
          <div className="text-xl font-[family-name:var(--font-kalam)] text-accent">
            游戏不存在
          </div>
        </div>
      </div>
    );
  }

  const isNight = game.currentPhase.startsWith("night");

  return (
    <div
      className="min-h-screen transition-all duration-1000 relative overflow-hidden"
      style={{
        background: isNight
          ? "linear-gradient(180deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)"
          : "#fdfbf7",
      }}
    >
      {/* Moonlight glow effect */}
      {isNight && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-20 right-10 w-40 h-40 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, #e0e7ff 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-4 right-16 w-12 h-12 rounded-full opacity-60"
            style={{ background: "radial-gradient(circle, #fef9c3 0%, #fde68a 40%, transparent 70%)", boxShadow: "0 0 40px 15px rgba(254, 249, 195, 0.15)" }}
          />
          {/* Subtle stars */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-white/30 animate-pulse"
              style={{
                top: `${10 + (i * 37) % 30}%`,
                left: `${5 + (i * 53) % 90}%`,
                animationDelay: `${i * 0.4}s`,
                animationDuration: `${2 + (i % 3)}s`,
              }}
            />
          ))}
        </div>
      )}
      <div className={`max-w-5xl mx-auto p-4 md:p-6 relative z-10 ${isNight ? "text-slate-100" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className={`flex items-center gap-1 text-sm transition-colors hand-link ${isNight ? "text-slate-400 hover:text-slate-200" : "text-foreground/50 hover:text-accent"}`}>
            ← 返回社区
          </Link>
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-kalam)] font-bold">
              🐺 狼人杀 Arena
            </h1>
            {game.modeId && (
              <div className="text-xs text-foreground/40 mt-0.5">{MODE_LABELS[game.modeId] ?? game.modeId}</div>
            )}
            <div className={`flex items-center justify-center gap-1 text-xs mt-0.5 ${isNight ? "text-slate-400" : "text-foreground/40"}`}>
              {connected ? <Wifi size={12} strokeWidth={2.5} className="text-green-400" /> : <WifiOff size={12} strokeWidth={2.5} className="text-accent" />}
              {connected ? "实时连接" : reconnecting ? "重连中..." : "连接断开"}
            </div>
          </div>
          <div className={`text-sm font-[family-name:var(--font-kalam)] font-bold px-3 py-1 border-2 ${isNight ? "text-slate-300 border-slate-500" : "text-foreground/60 border-ink/30"}`} style={{ borderRadius: WOBBLY_SM }}>
            第 {game.currentRound} 轮
          </div>
        </div>

        <PhaseIndicator phase={game.currentPhase} isNight={isNight} />

        {game.status === "lobby" && (
          <div className="text-center mb-8">
            <button
              onClick={handleStart}
              className="px-10 py-4 bg-white border-[3px] border-ink text-xl font-[family-name:var(--font-kalam)] font-bold shadow-hand-interactive hover:bg-accent hover:text-white"
              style={{ borderRadius: WOBBLY }}
            >
              🎮 开始游戏
            </button>
          </div>
        )}

        {game.winner && <GameOverBanner winner={game.winner} players={playerList} />}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <PlayerSidebar players={playerList} thinkingPlayerId={thinkingPlayer} />
          <ChatFeed
            feed={feed}
            players={playerList}
            thinkingPlayerId={thinkingPlayer}
            showPrivate={showPrivate}
            setShowPrivate={setShowPrivate}
            showGodView={showGodView}
            setShowGodView={setShowGodView}
            gameStatus={game.status}
          />
        </div>
      </div>
    </div>
  );
}
