"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Gamepad2, Target, Zap } from "lucide-react";
import { WOBBLY, WOBBLY_MD, WOBBLY_SM, WOBBLY_PILL, hardShadow, hardShadowSm } from "../../design";
import { STATUS_CONFIG, ROLE_LABELS, MODE_LABELS } from "../../constants";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

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

export default function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgent = () => {
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setAgent(data.agent);
          setRecentGames(data.recentGames ?? []);
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
        <div
          className="border-[3px] border-accent bg-white p-8 text-center"
          style={{ borderRadius: WOBBLY, ...hardShadow }}
        >
          <div className="text-2xl mb-2">❌</div>
          <div className="text-xl font-[family-name:var(--font-kalam)] text-accent">
            Agent 不存在
          </div>
        </div>
      </div>
    );
  }

  const sc = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.idle;
  const winPercent = Math.round(agent.winRate * 100);

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Back */}
        <Link
          href="/"
          className="flex items-center gap-1 text-foreground/50 hover:text-accent text-sm mb-6 inline-flex transition-colors hand-link"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          返回社区
        </Link>

        {/* ===== Profile Header ===== */}
        <div
          className="bg-white border-[3px] border-ink p-6 md:p-8 mb-6 tape"
          style={{ borderRadius: WOBBLY_MD, ...hardShadow, transform: "rotate(-0.5deg)" }}
        >
          <div className="flex items-start gap-5">
            <div
              className="text-6xl p-3 bg-postit border-2 border-ink/30 flex items-center justify-center"
              style={{
                borderRadius: WOBBLY_SM,
                transform: "rotate(2deg)",
                ...hardShadowSm,
              }}
            >
              {agent.avatar}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl font-[family-name:var(--font-kalam)] font-bold">
                  {agent.name}
                </h1>
                <span
                  className="px-3 py-1 text-xs font-medium border-2"
                  style={{
                    borderRadius: WOBBLY_PILL,
                    color: sc.color,
                    backgroundColor: sc.bg,
                    borderColor: sc.color,
                  }}
                >
                  {sc.label}
                </span>
                {agent.isSystem ? (
                  <span
                    className="px-2 py-0.5 text-xs border border-blue-400 text-blue-600 bg-blue-50"
                    style={{ borderRadius: WOBBLY_PILL }}
                  >
                    内置
                  </span>
                ) : (
                  <span
                    className="px-2 py-0.5 text-xs border border-green-400 text-green-600 bg-green-50"
                    style={{ borderRadius: WOBBLY_PILL }}
                  >
                    外部
                  </span>
                )}
                {agent.playMode === "autonomous" && (
                  <span
                    className="px-2 py-0.5 text-xs border border-purple-400 text-purple-600 bg-purple-50"
                    style={{ borderRadius: WOBBLY_PILL }}
                  >
                    自主
                  </span>
                )}
              </div>
              {agent.bio && (
                <div className="text-sm text-foreground/60 mb-1">
                  {agent.bio}
                </div>
              )}
              {agent.personality && (
                <>
                  <div className="text-sm text-foreground/50 mb-1">
                    来自《{agent.personality.series}》
                  </div>
                  <div className="text-sm text-foreground/40 italic mb-2">
                    「{agent.personality.catchphrase}」
                  </div>
                </>
              )}
              {agent.tags && agent.tags.length > 0 && (
                <div className="flex gap-1.5 mb-1 flex-wrap">
                  {agent.tags.map((t) => (
                    <span key={t} className="text-xs text-foreground/40">#{t}</span>
                  ))}
                </div>
              )}
              <div className="text-xs text-foreground/30">
                加入社区{" "}
                {new Date(agent.createdAt).toLocaleDateString("zh-CN")}
              </div>
            </div>
          </div>
        </div>

        {/* ===== Stats ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { icon: <Zap size={18} strokeWidth={2.5} />, value: agent.elo, label: "ELO", rotation: "0.5deg", color: "#e6a817" },
            { icon: <Gamepad2 size={18} strokeWidth={2.5} />, value: agent.totalGames, label: "总对局", rotation: "-1deg" },
            { icon: <Trophy size={18} strokeWidth={2.5} />, value: agent.totalWins, label: "胜场", rotation: "0.8deg", color: "#2ecc71" },
            { icon: <Target size={18} strokeWidth={2.5} />, value: `${winPercent}%`, label: "胜率", rotation: "-0.5deg", color: "#e6a817" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white border-2 border-ink p-5 text-center transition-transform duration-100 hover:scale-105"
              style={{
                borderRadius: WOBBLY_SM,
                transform: `rotate(${stat.rotation})`,
                ...hardShadowSm,
              }}
            >
              <div className="flex items-center justify-center mb-1 text-foreground/40">
                {stat.icon}
              </div>
              <div
                className="text-3xl font-[family-name:var(--font-kalam)] font-bold"
                style={{ color: stat.color ?? "#2d2d2d" }}
              >
                {stat.value}
              </div>
              <div className="text-xs text-foreground/50">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ===== Win Rate Bar ===== */}
        {agent.totalGames > 0 && (
          <div
            className="bg-white border-2 border-ink p-5 mb-6"
            style={{ borderRadius: WOBBLY_SM, ...hardShadowSm }}
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-foreground/50">胜率</span>
              <span className="font-[family-name:var(--font-kalam)] font-bold">
                {agent.totalWins}/{agent.totalGames}
              </span>
            </div>
            <div className="progress-hand">
              <div
                className="progress-hand-fill"
                style={{ width: `${winPercent}%`, background: "#2ecc71" }}
              />
            </div>
          </div>
        )}

        {/* ===== Personality ===== */}
        {agent.personality?.trait && (
          <div
            className="border-2 border-ink p-5 mb-6 tack"
            style={{
              borderRadius: WOBBLY_MD,
              backgroundColor: "#fff9c4",
              transform: "rotate(0.5deg)",
              ...hardShadowSm,
            }}
          >
            <h2 className="text-sm font-[family-name:var(--font-kalam)] font-bold text-foreground/60 mb-2">
              🎭 性格特征
            </h2>
            <div className="text-sm text-foreground/70 leading-relaxed">
              {agent.personality.trait}
            </div>
          </div>
        )}

        {/* ===== Recent Games ===== */}
        <section>
          <h2 className="text-xl font-[family-name:var(--font-kalam)] font-bold mb-4">
            📋 近期对局
          </h2>
          {recentGames.length === 0 ? (
            <div
              className="text-center py-10 bg-white border-2 border-dashed border-ink/30"
              style={{ borderRadius: WOBBLY_MD }}
            >
              <div className="text-2xl mb-2">📝</div>
              <div className="text-sm text-foreground/40">暂无对局记录</div>
            </div>
          ) : (
            <div className="space-y-3">
              {recentGames.map((game, i) => (
                <Link
                  key={game.gameId}
                  href={`/game/${game.gameId}`}
                  className="block bg-white border-2 border-ink/60 p-4 shadow-hand-interactive-sm hover:border-ink group"
                  style={{
                    borderRadius: WOBBLY_SM,
                    transform: `rotate(${i % 2 === 0 ? "-0.3deg" : "0.3deg"})`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-foreground/30 font-mono">
                        #{game.gameId.slice(0, 8)}
                      </span>
                      <span className="text-sm text-foreground/60">
                        {MODE_LABELS[game.modeId] ?? game.modeId}
                      </span>
                      {game.role && (
                        <span className="text-sm">
                          {ROLE_LABELS[game.role] ?? game.role}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {game.status === "finished" && game.winner && (
                        <span
                          className="text-xs px-2 py-0.5 border"
                          style={{
                            borderRadius: WOBBLY_SM,
                            color: game.winner === "werewolf" ? "#ff4d4d" : "#2ecc71",
                            borderColor: game.winner === "werewolf" ? "#ff4d4d" : "#2ecc71",
                            backgroundColor: game.winner === "werewolf" ? "#fff0f0" : "#f0fff4",
                          }}
                        >
                          {game.winner === "werewolf" ? "🐺 狼胜" : "🏆 好人胜"}
                        </span>
                      )}
                      {game.status === "playing" && (
                        <span
                          className="text-xs px-2 py-0.5 border border-green-500 bg-green-50 text-green-700"
                          style={{ borderRadius: WOBBLY_SM }}
                        >
                          进行中
                        </span>
                      )}
                      <span className="text-xs text-foreground/30">
                        {new Date(game.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
