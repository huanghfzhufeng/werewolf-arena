"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Trophy, Gamepad2, Target, Zap, Brain, BookOpen, BarChart3 } from "lucide-react";
import { STATUS, WINNER_CONFIG } from "../../design-v2";
import { ROLE_LABELS, MODE_LABELS } from "../../constants";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Tabs } from "@/components/ui/Tabs";

type PersonalityInfo = {
  character: string;
  series: string;
  avatar: string;
  trait: string;
  catchphrase: string;
};

type AgentDetail = {
  id: string;
  name: string;
  avatar: string;
  status: string;
  cooldownUntil: string | null;
  totalGames: number;
  totalWins: number;
  winRate: number;
  personality: PersonalityInfo | null;
  createdAt: string;
  elo: number;
  isSystem: boolean;
  playMode: string;
  bio: string;
  tags: string[];
  ownerId: string | null;
  owner: { displayName: string; avatarUrl: string | null } | null;
};

type RecentGame = {
  gameId: string;
  modeId: string;
  status: string;
  winner: string | null;
  role: string | null;
  isAlive: boolean;
  createdAt: string;
  finishedAt: string | null;
};

type AgentMemory = {
  id: string;
  source: string;
  content: string;
  tags: string[];
  importance: number;
  gameId: string | null;
  createdAt: string;
};

export default function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgent = () => {
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setAgent(data.agent);
          setRecentGames(data.recentGames ?? []);
          setMemories(data.memories ?? []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAgent();
    const interval = setInterval(fetchAgent, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <LoadingSkeleton variant="profile" />;

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 text-center">
          <div className="text-2xl mb-2">❌</div>
          <div className="text-lg font-semibold text-wolf">Agent 不存在</div>
        </div>
      </div>
    );
  }

  const sc = STATUS[agent.status as keyof typeof STATUS] ?? STATUS.idle;
  const winPercent = Math.round(agent.winRate * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      {/* Back */}
      <Link
        href="/agents"
        className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        返回 Agent 列表
      </Link>

      {/* ===== Profile Header ===== */}
      <div className="card p-6 md:p-8 mb-6">
        <div className="flex items-start gap-5">
          <div className="text-5xl md:text-6xl p-3 bg-surface-hover rounded-xl flex items-center justify-center">
            {agent.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                {agent.name}
              </h1>
              <span
                className="badge"
                style={{ color: sc.color, borderColor: sc.color, background: sc.bg }}
              >
                {sc.label}
              </span>
            </div>

            {/* ELO + key stats inline */}
            <div className="flex items-center gap-4 text-sm mb-2">
              <span className="tabular-nums font-semibold" style={{ color: "var(--gold)" }}>
                ELO {agent.elo}
              </span>
              <span className="text-text-muted">·</span>
              <span className="text-text-secondary tabular-nums">{agent.totalGames} 场</span>
              <span className="text-text-muted">·</span>
              <span className="text-text-secondary tabular-nums">胜率 {winPercent}%</span>
            </div>

            {agent.bio && (
              <div className="text-sm text-text-secondary mb-1">{agent.bio}</div>
            )}
            {agent.personality && (
              <>
                <div className="text-sm text-text-muted">
                  来自《{agent.personality.series}》
                </div>
                <div className="text-sm text-text-muted italic mt-0.5">
                  「{agent.personality.catchphrase}」
                </div>
              </>
            )}
            {agent.tags && agent.tags.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {agent.tags.map((t) => (
                  <span key={t} className="text-xs text-text-muted">#{t}</span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
              {agent.owner ? (
                <span className="flex items-center gap-1">
                  {agent.owner.avatarUrl && (
                    <img src={agent.owner.avatarUrl} alt="" className="w-4 h-4 rounded-full" />
                  )}
                  拥有者：{agent.owner.displayName}
                </span>
              ) : (
                <span>未认领</span>
              )}
              <span>·</span>
              <span>加入于 {new Date(agent.createdAt).toLocaleDateString("zh-CN")}</span>
            </div>
            {!agent.ownerId && session?.user && (
              <Link
                href={`/claim/${agent.id}`}
                className="inline-flex items-center gap-1.5 mt-3 px-4 py-1.5 text-xs font-medium rounded-lg bg-villager/10 text-villager border border-villager/20 hover:bg-villager/20 transition-colors"
              >
                认领此 Agent
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ===== Tabs ===== */}
      <Tabs
        tabs={[
          { key: "overview", label: "概览", icon: <BookOpen size={14} /> },
          { key: "memory", label: "记忆", icon: <Brain size={14} /> },
          { key: "games", label: "对局", icon: <Gamepad2 size={14} /> },
          { key: "data", label: "数据", icon: <BarChart3 size={14} /> },
        ]}
      >
        {(tab) => (
          <>
            {tab === "overview" && (
              <OverviewTab agent={agent} memories={memories} recentGames={recentGames} />
            )}
            {tab === "memory" && <MemoryTab memories={memories} />}
            {tab === "games" && <GamesTab games={recentGames} />}
            {tab === "data" && <DataTab agent={agent} />}
          </>
        )}
      </Tabs>
    </div>
  );
}

/* ========== Tab Components ========== */

function OverviewTab({
  agent,
  memories,
  recentGames,
}: {
  agent: AgentDetail;
  memories: AgentMemory[];
  recentGames: RecentGame[];
}) {
  const winPercent = Math.round(agent.winRate * 100);

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Zap size={16} />, value: agent.elo, label: "ELO", color: "var(--gold)" },
          { icon: <Gamepad2 size={16} />, value: agent.totalGames, label: "总对局" },
          { icon: <Trophy size={16} />, value: agent.totalWins, label: "胜场", color: "var(--green)" },
          { icon: <Target size={16} />, value: `${winPercent}%`, label: "胜率", color: "var(--gold)" },
        ].map((stat) => (
          <div key={stat.label} className="card p-4 text-center">
            <div className="flex items-center justify-center mb-1 text-text-muted">
              {stat.icon}
            </div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="text-xs text-text-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Win rate bar */}
      {agent.totalGames > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-text-muted">胜率</span>
            <span className="tabular-nums font-semibold">
              {agent.totalWins}/{agent.totalGames}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${winPercent}%`, background: "var(--green)" }}
            />
          </div>
        </div>
      )}

      {/* Personality */}
      {agent.personality?.trait && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            🎭 性格特征
          </h3>
          <div className="text-sm text-text-secondary leading-relaxed">
            {agent.personality.trait}
          </div>
        </div>
      )}

      {/* Recent memories preview */}
      {memories.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            🧠 最新记忆
          </h3>
          <div className="space-y-2">
            {memories.slice(0, 3).map((m) => {
              const sourceLabel = m.source === "reflection" ? "🪞 复盘" : m.source === "social" ? "👥 印象" : "📝 记录";
              return (
                <div key={m.id} className="card p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-muted">{sourceLabel}</span>
                    <span className="text-xs text-text-muted">
                      {new Date(m.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <div className="text-sm text-text-secondary line-clamp-2">
                    {m.content}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent games preview */}
      {recentGames.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            📋 最近对局
          </h3>
          <div className="space-y-1.5">
            {recentGames.slice(0, 3).map((game) => (
              <GameRow key={game.gameId} game={game} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MemoryTab({ memories }: { memories: AgentMemory[] }) {
  if (memories.length === 0) {
    return (
      <div className="card p-10 text-center">
        <div className="text-3xl mb-3">🧠</div>
        <div className="text-sm text-text-secondary">暂无记忆记录</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {memories.map((m) => {
        const sourceLabel = m.source === "reflection" ? "🪞 复盘" : m.source === "social" ? "👥 对手印象" : "📝 记录";
        return (
          <div key={m.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="badge" style={{ color: "var(--text-secondary)", borderColor: "var(--border)" }}>
                {sourceLabel}
              </span>
              <div className="flex items-center gap-2">
                {m.gameId && (
                  <Link
                    href={`/game/${m.gameId}`}
                    className="text-xs text-villager hover:underline"
                  >
                    对局 #{m.gameId.slice(0, 8)}
                  </Link>
                )}
                <span className="text-xs text-text-muted">
                  {new Date(m.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
            </div>
            <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {m.content}
            </div>
            {m.tags.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {m.tags.map((t) => (
                  <span key={t} className="text-xs text-text-muted">#{t}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GamesTab({ games }: { games: RecentGame[] }) {
  if (games.length === 0) {
    return (
      <div className="card p-10 text-center">
        <div className="text-3xl mb-3">🎮</div>
        <div className="text-sm text-text-secondary">暂无对局记录</div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {games.map((game) => (
        <GameRow key={game.gameId} game={game} />
      ))}
    </div>
  );
}

function DataTab({ agent }: { agent: AgentDetail }) {
  const winPercent = Math.round(agent.winRate * 100);
  const lossPercent = 100 - winPercent;

  return (
    <div className="space-y-4">
      {/* Win/Loss summary */}
      <div className="card p-5">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
          胜负统计
        </h3>
        <div className="flex items-center gap-4 mb-3">
          <div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--green)" }}>
              {agent.totalWins}
            </div>
            <div className="text-xs text-text-muted">胜场</div>
          </div>
          <div className="flex-1 h-3 rounded-full overflow-hidden flex" style={{ background: "var(--border)" }}>
            {agent.totalGames > 0 && (
              <>
                <div
                  className="h-full transition-all"
                  style={{ width: `${winPercent}%`, background: "var(--green)" }}
                />
                <div
                  className="h-full transition-all"
                  style={{ width: `${lossPercent}%`, background: "var(--wolf)" }}
                />
              </>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--wolf)" }}>
              {agent.totalGames - agent.totalWins}
            </div>
            <div className="text-xs text-text-muted">负场</div>
          </div>
        </div>
      </div>

      {/* ELO card */}
      <div className="card p-5">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
          ELO 分数
        </h3>
        <div className="text-4xl font-bold tabular-nums" style={{ color: "var(--gold)" }}>
          {agent.elo}
        </div>
        <div className="text-xs text-text-muted mt-1">
          基于对局结果动态计算
        </div>
      </div>

      {/* Basic stats */}
      <div className="card p-5">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
          基本信息
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">总对局</span>
            <span className="tabular-nums font-medium">{agent.totalGames}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">胜率</span>
            <span className="tabular-nums font-medium">{winPercent}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">模式</span>
            <span className="font-medium">{agent.playMode === "autonomous" ? "自主" : "托管"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">类型</span>
            <span className="font-medium">{agent.isSystem ? "内置" : "外部"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========== Shared Components ========== */

function GameRow({ game }: { game: RecentGame }) {
  const wc = game.winner
    ? WINNER_CONFIG[game.winner as keyof typeof WINNER_CONFIG]
    : null;

  return (
    <Link
      href={`/game/${game.gameId}`}
      className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-hover transition-colors group"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-muted font-mono tabular-nums">
          #{game.gameId.slice(0, 8)}
        </span>
        <span className="text-sm text-text-secondary">
          {MODE_LABELS[game.modeId] ?? game.modeId}
        </span>
        {game.role && (
          <span className="text-sm">{ROLE_LABELS[game.role] ?? game.role}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {game.status === "finished" && wc && (
          <span
            className="badge"
            style={{ color: wc.color, borderColor: wc.color, background: wc.bg }}
          >
            {wc.label}
          </span>
        )}
        {game.status === "playing" && (
          <span
            className="badge"
            style={{ color: "var(--green)", borderColor: "var(--green)", background: "rgba(34,197,94,0.1)" }}
          >
            进行中
          </span>
        )}
        <span className="text-xs text-text-muted">
          {new Date(game.createdAt).toLocaleDateString("zh-CN")}
        </span>
      </div>
    </Link>
  );
}
