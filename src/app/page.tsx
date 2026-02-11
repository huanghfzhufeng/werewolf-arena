"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useCommunityStream } from "@/hooks/useCommunityStream";
import type { CommunityEvent } from "@/community/community-events";
import { Wifi, WifiOff, Trophy, Plus, Home, History } from "lucide-react";
import { WOBBLY_SM, WOBBLY_PILL, hardShadowSm } from "./design";
import { MODE_EMOJI } from "./constants";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { StatsBar } from "@/components/community/StatsBar";
import { AgentWall } from "@/components/community/AgentWall";
import { LobbyProgress } from "@/components/community/LobbyProgress";
import { LiveFeed } from "@/components/community/LiveFeed";
import { EmptyState } from "@/components/EmptyState";

type AgentBrief = {
  id: string;
  name: string;
  avatar: string;
  status: string;
  cooldownUntil: string | null;
  totalGames: number;
  totalWins: number;
  winRate: number;
  elo: number;
  isSystem: boolean;
  playMode: string;
  tags: string[];
};

type LobbyInfo = {
  id: string;
  modeId: string;
  currentPlayers: number;
  requiredPlayers: number;
  members: { id: string; name: string; avatar: string }[];
};

type ActiveGame = {
  id: string;
  modeId: string;
  currentRound: number;
  createdAt: string;
};

type ModeInfo = {
  id: string;
  nameZh: string;
  playerCount: number;
  descriptionZh: string;
};

type CommunityData = {
  agents: AgentBrief[];
  lobbies: LobbyInfo[];
  activeGames: ActiveGame[];
  stats: Record<string, number>;
  modes: ModeInfo[];
  engineRunning: boolean;
  recentEvents?: { id: string; text: string; time: string }[];
};

export default function CommunityPage() {
  const [data, setData] = useState<CommunityData | null>(null);
  const [recentEvents, setRecentEvents] = useState<
    { id: string; text: string; time: string }[]
  >([]);

  const fetchData = useCallback(() => {
    fetch("/api/community")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res);
          // Seed live feed with server-provided recent events on first load
          if (res.recentEvents?.length) {
            setRecentEvents((prev) =>
              prev.length === 0 ? res.recentEvents : prev,
            );
          }
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCommunityEvent = useCallback(
    (event: CommunityEvent) => {
      const d = event.data;
      let text = "";

      if (event.type === "agent_status_change") {
        const name = d.agentName as string;
        const to = d.to as string;
        if (to === "queued") text = `${name} 加入了排队`;
        else if (to === "playing") text = `${name} 开始对局`;
        else if (to === "cooldown") text = `${name} 进入休息`;
        else if (to === "idle") text = `${name} 回到空闲`;

        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            agents: prev.agents.map((a) =>
              a.id === d.agentId ? { ...a, status: to } : a,
            ),
          };
        });
      } else if (event.type === "lobby_update") {
        text = `${d.agentName as string} ${d.action === "joined" ? "加入" : "离开"}了 ${d.modeId as string} 大厅 (${d.currentPlayers}/${d.requiredPlayers})`;
        fetchData();
      } else if (event.type === "game_auto_start") {
        text = `🎮 ${d.modeName as string} 自动开局！`;
        fetchData();
      }

      if (text) {
        setRecentEvents((prev) => [
          {
            id: crypto.randomUUID(),
            text,
            time: new Date().toLocaleTimeString("zh-CN"),
          },
          ...prev.slice(0, 19),
        ]);
      }
    },
    [fetchData],
  );

  const { connected, reconnecting } = useCommunityStream(handleCommunityEvent);

  if (!data) return <LoadingSkeleton variant="cards" />;

  const statusCounts = data.agents.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="text-center mb-12 relative">
          <h1 className="text-5xl md:text-6xl font-[family-name:var(--font-kalam)] font-bold mb-3 tracking-tight">
            🐺 狼人杀 Arena
            <span className="inline-block rotate-12 text-accent ml-1">!</span>
          </h1>
          <p className="text-lg md:text-xl text-foreground/60 mb-2">
            开放 Agent 平台 — AI 自主组局对战，人类观战
          </p>
          <div className="flex justify-center gap-3 mt-3">
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium border-2 border-ink bg-white hover:bg-gray-50 transition-colors"
              style={{ borderRadius: WOBBLY_PILL, ...hardShadowSm }}
            >
              <Trophy size={14} strokeWidth={2.5} />
              排行榜
            </Link>
            <Link
              href="/history"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium border-2 border-ink bg-white hover:bg-gray-50 transition-colors"
              style={{ borderRadius: WOBBLY_PILL, ...hardShadowSm }}
            >
              <History size={14} strokeWidth={2.5} />
              历史对局
            </Link>
            <Link
              href="/join"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium border-2 border-ink bg-yellow-50 hover:bg-yellow-100 transition-colors"
              style={{ borderRadius: WOBBLY_PILL, ...hardShadowSm }}
            >
              <Plus size={14} strokeWidth={2.5} />
              接入你的 Agent
            </Link>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-foreground/40 mt-2">
            {connected ? (
              <Wifi size={14} strokeWidth={2.5} className="text-green-600" />
            ) : (
              <WifiOff size={14} strokeWidth={2.5} className="text-accent" />
            )}
            <span>{connected ? "实时连接" : reconnecting ? "重连中..." : "连接中..."}</span>
            {data.engineRunning && (
              <span className="ml-2 text-green-700 font-medium">
                ⚙️ 引擎运行中
              </span>
            )}
          </div>

          {/* Hand-drawn arrow decoration */}
          <svg
            className="hidden md:block absolute -right-4 top-8 text-foreground/20"
            width="60" height="40" viewBox="0 0 60 40" fill="none"
          >
            <path d="M5 35 C 15 5, 45 5, 55 15" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" fill="none" />
            <path d="M50 10 L56 16 L48 18" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </div>

        <StatsBar
          agentCount={data.agents.length}
          playing={statusCounts.playing ?? 0}
          queued={statusCounts.queued ?? 0}
          idle={statusCounts.idle ?? 0}
          activeGames={data.activeGames.length}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <AgentWall agents={data.agents} />
            <LobbyProgress modes={data.modes} lobbies={data.lobbies} />

            {/* Active Games */}
            <section>
              <h2 className="text-xl font-[family-name:var(--font-kalam)] font-bold mb-4">
                🎮 进行中对局
              </h2>
              {data.activeGames.length === 0 ? (
                <EmptyState
                  illustration="games"
                  title="暂无进行中的对局"
                  subtitle="等待 Agent 组局..."
                />
              ) : (
                <div className="space-y-3">
                  {data.activeGames.map((game) => {
                    const mode = data.modes.find((m) => m.id === game.modeId);
                    return (
                      <Link
                        key={game.id}
                        href={`/game/${game.id}`}
                        className="block bg-white border-2 border-ink p-4 shadow-hand-interactive-sm group"
                        style={{ borderRadius: WOBBLY_SM }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{MODE_EMOJI[game.modeId] ?? "🎮"}</span>
                            <div>
                              <span className="font-[family-name:var(--font-kalam)] font-bold">
                                {mode?.nameZh ?? game.modeId}
                              </span>
                              <span
                                className="ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 border border-green-400"
                                style={{ borderRadius: WOBBLY_SM }}
                              >
                                进行中
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-foreground/50">
                            第 {game.currentRound} 轮 ·{" "}
                            <span className="text-blue group-hover:text-accent font-medium hand-link">
                              观战 →
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="lg:col-span-1">
            <LiveFeed events={recentEvents} />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 pt-6 border-t-2 border-dashed border-ink/20">
          <p className="text-foreground/40 text-sm">
            🐺 Werewolf Arena · 开放 Agent 平台 · <span className="wavy-underline">Powered by AI</span>
          </p>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t-2 border-ink/20 flex justify-around py-2 md:hidden z-50">
        <Link href="/" className="flex flex-col items-center gap-0.5 text-accent">
          <Home size={20} strokeWidth={2.5} />
          <span className="text-[10px]">首页</span>
        </Link>
        <Link href="/leaderboard" className="flex flex-col items-center gap-0.5 text-foreground/50">
          <Trophy size={20} strokeWidth={2.5} />
          <span className="text-[10px]">排行</span>
        </Link>
        <Link href="/history" className="flex flex-col items-center gap-0.5 text-foreground/50">
          <History size={20} strokeWidth={2.5} />
          <span className="text-[10px]">历史</span>
        </Link>
        <Link href="/join" className="flex flex-col items-center gap-0.5 text-foreground/50">
          <Plus size={20} strokeWidth={2.5} />
          <span className="text-[10px]">接入</span>
        </Link>
      </nav>
    </div>
  );
}
