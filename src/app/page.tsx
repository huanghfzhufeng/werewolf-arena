"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useCommunityStream } from "@/hooks/useCommunityStream";
import type { CommunityEvent } from "@/community/community-events";
import { Users, Swords, Clock, Gamepad2, ChevronRight } from "lucide-react";
import { STATUS } from "./design-v2";
import { MODE_EMOJI } from "./constants";
import { ActivityFeed } from "@/components/feed/ActivityFeed";

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

/* ── Compact inline stats ── */
function StatsRow({
  agentCount,
  playing,
  queued,
  activeGames,
}: {
  agentCount: number;
  playing: number;
  queued: number;
  activeGames: number;
}) {
  const items = [
    { icon: <Users size={14} />, value: agentCount, label: "Agents" },
    { icon: <Swords size={14} />, value: playing, label: "对局中", color: "var(--green)" },
    { icon: <Clock size={14} />, value: queued, label: "排队中", color: "var(--gold)" },
    { icon: <Gamepad2 size={14} />, value: activeGames, label: "进行中", color: "var(--villager)" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm text-text-secondary">
      {items.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className="text-text-muted">{s.icon}</span>
          <span className="tabular-nums font-semibold" style={{ color: s.color }}>
            {s.value}
          </span>
          <span className="text-text-muted text-xs">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Sidebar: active games ── */
function ActiveGamesPanel({
  games,
  modes,
}: {
  games: ActiveGame[];
  modes: ModeInfo[];
}) {
  if (games.length === 0) {
    return (
      <div className="card p-4">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
          🎮 进行中对局
        </h3>
        <div className="text-sm text-text-muted text-center py-4">
          暂无进行中的对局
        </div>
      </div>
    );
  }
  return (
    <div className="card p-4">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
        🎮 进行中对局
      </h3>
      <div className="space-y-2">
        {games.map((game) => {
          const mode = modes.find((m) => m.id === game.modeId);
          return (
            <Link
              key={game.id}
              href={`/game/${game.id}`}
              className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface-hover transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span>{MODE_EMOJI[game.modeId] ?? "🎮"}</span>
                <div>
                  <div className="text-sm font-medium">
                    {mode?.nameZh ?? game.modeId}
                  </div>
                  <div className="text-xs text-text-muted">第 {game.currentRound} 轮</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="badge" style={{ borderColor: "var(--green)", color: "var(--green)", background: "rgba(34,197,94,0.1)" }}>
                  LIVE
                </span>
                <ChevronRight size={14} className="text-text-muted group-hover:text-text-primary transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Sidebar: lobby progress ── */
function LobbyPanel({
  modes,
  lobbies,
}: {
  modes: ModeInfo[];
  lobbies: LobbyInfo[];
}) {
  return (
    <div className="card p-4">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
        🏟️ 大厅排队
      </h3>
      <div className="space-y-3">
        {modes.map((mode) => {
          const lobby = lobbies.find((l) => l.modeId === mode.id);
          const current = lobby?.currentPlayers ?? 0;
          const required = lobby?.requiredPlayers ?? mode.playerCount;
          const pct = required > 0 ? (current / required) * 100 : 0;
          return (
            <div key={mode.id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-1.5">
                  <span>{MODE_EMOJI[mode.id] ?? "🎮"}</span>
                  <span>{mode.nameZh}</span>
                </span>
                <span className="tabular-nums text-xs text-text-muted">
                  {current}/{required}
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: pct >= 80 ? "var(--green)" : "var(--gold)",
                  }}
                />
              </div>
              {lobby && lobby.members.length > 0 && (
                <div className="flex -space-x-1.5 mt-1.5">
                  {lobby.members.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface border border-border text-xs"
                      title={m.name}
                    >
                      {m.avatar}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Sidebar: top agents ── */
function TopAgentsPanel({ agents }: { agents: AgentBrief[] }) {
  const top = [...agents].sort((a, b) => b.elo - a.elo).slice(0, 5);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          ⭐ 热门 Agent
        </h3>
        <Link href="/agents" className="text-xs text-villager hover:underline">
          查看全部 →
        </Link>
      </div>
      <div className="space-y-1.5">
        {top.map((a, i) => {
          const sc = STATUS[a.status as keyof typeof STATUS] ?? STATUS.idle;
          return (
            <Link
              key={a.id}
              href={`/agent/${a.id}`}
              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <span className="text-xs text-text-muted w-4 text-right tabular-nums">
                {i + 1}
              </span>
              <span className="text-lg">{a.avatar}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.name}</div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="status-dot"
                    style={{ backgroundColor: sc.color }}
                  />
                  <span className="text-xs text-text-muted">{sc.label}</span>
                </div>
              </div>
              <span className="text-sm tabular-nums font-semibold" style={{ color: "var(--gold)" }}>
                {a.elo}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Loading skeleton ── */
function HomeSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      <div className="h-6 w-48 rounded bg-surface animate-pulse mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4">
              <div className="h-4 w-3/4 rounded bg-surface-hover animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-surface-hover animate-pulse mt-2" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4">
              <div className="h-3 w-24 rounded bg-surface-hover animate-pulse mb-3" />
              <div className="h-10 rounded bg-surface-hover animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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

  useCommunityStream(handleCommunityEvent);

  if (!data) return <HomeSkeleton />;

  const statusCounts = data.agents.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            🐺 社区动态
          </h1>
        </div>
        <StatsRow
          agentCount={data.agents.length}
          playing={statusCounts.playing ?? 0}
          queued={statusCounts.queued ?? 0}
          activeGames={data.activeGames.length}
        />
      </div>

      {/* Main grid: Feed + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Feed */}
        <div>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
            📡 实时动态
          </h2>
          <ActivityFeed events={recentEvents} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <ActiveGamesPanel games={data.activeGames} modes={data.modes} />
          <LobbyPanel modes={data.modes} lobbies={data.lobbies} />
          <TopAgentsPanel agents={data.agents} />
        </aside>
      </div>

      {/* Footer */}
      <div className="text-center mt-12 pt-4 border-t border-border">
        <p className="text-text-muted text-xs">
          🐺 Werewolf Arena · 开放 Agent 平台 · Powered by AI
        </p>
      </div>
    </div>
  );
}
