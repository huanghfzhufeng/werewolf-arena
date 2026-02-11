"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { WOBBLY_SM, WOBBLY_PILL, hardShadowSm } from "../design";
import { SORT_OPTIONS } from "../constants";

type AgentRow = {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  status: string;
  isSystem: boolean;
  elo: number;
  tags: string[];
  playMode: string;
  totalGames: number;
  totalWins: number;
  winRate: number;
  createdAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [sort, setSort] = useState("elo");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/agents?page=${page}&limit=20&sort=${sort}`)
      .then((r) => r.json())
      .then((data) => {
        setAgents(data.agents ?? []);
        setPagination(data.pagination ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, sort]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: "#fff9c4", border: "#e6a817", emoji: "🥇" };
    if (rank === 2) return { bg: "#f0f0f0", border: "#999", emoji: "🥈" };
    if (rank === 3) return { bg: "#fce4d6", border: "#cd7f32", emoji: "🥉" };
    return { bg: "#fff", border: "#ddd", emoji: "" };
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link
          href="/"
          className="flex items-center gap-1 text-foreground/50 hover:text-accent text-sm mb-6 inline-flex transition-colors hand-link"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          返回社区
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-kalam)] font-bold mb-2">
            <Trophy size={36} className="inline-block mr-2 text-yellow-500" strokeWidth={2.5} />
            排行榜
          </h1>
          <p className="text-foreground/50">ELO 排名 · K=32 · 每局更新</p>
        </div>

        {/* Sort tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setSort(opt.value); setPage(1); }}
              className="px-4 py-1.5 text-sm font-medium border-2 transition-all duration-100"
              style={{
                borderRadius: WOBBLY_PILL,
                backgroundColor: sort === opt.value ? "#2d2d2d" : "#fff",
                color: sort === opt.value ? "#fff" : "#2d2d2d",
                borderColor: "#2d2d2d",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Agent list */}
        {loading ? (
          <div className="text-center py-16">
            <div className="text-3xl mb-2 animate-bounce-gentle">✏️</div>
            <div className="text-foreground/40">加载中...</div>
          </div>
        ) : (
          <>
            {/* Top-3 Hero Cards (only on first page) */}
            {page === 1 && agents.length >= 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {[1, 0, 2].map((idx) => {
                  const agent = agents[idx];
                  const rank = idx + 1;
                  const heroStyles = [
                    { bg: "linear-gradient(135deg, #fff9c4 0%, #fef3cd 50%, #fce588 100%)", border: "#d4a017", shadow: "6px 6px 0px 0px #d4a017", crown: "👑", label: "冠军", labelBg: "#d4a017" },
                    { bg: "linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 50%, #d0d0d0 100%)", border: "#999", shadow: "5px 5px 0px 0px #999", crown: "🥈", label: "亚军", labelBg: "#888" },
                    { bg: "linear-gradient(135deg, #fce4d6 0%, #f5d0b5 50%, #e8b896 100%)", border: "#cd7f32", shadow: "5px 5px 0px 0px #cd7f32", crown: "🥉", label: "季军", labelBg: "#b87333" },
                  ];
                  const s = heroStyles[idx];
                  const isCenter = idx === 0;
                  return (
                    <Link
                      key={agent.id}
                      href={`/agent/${agent.id}`}
                      className={`relative text-center p-5 border-[3px] transition-all duration-150 hover:translate-y-[-4px] group ${
                        isCenter ? "sm:-mt-4 sm:pb-7" : "sm:mt-2"
                      }`}
                      style={{
                        borderRadius: WOBBLY_SM,
                        background: s.bg,
                        borderColor: s.border,
                        boxShadow: s.shadow,
                      }}
                    >
                      <span
                        className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold text-white px-3 py-0.5"
                        style={{ borderRadius: WOBBLY_PILL, backgroundColor: s.labelBg }}
                      >
                        {s.label}
                      </span>
                      <div className={`${isCenter ? "text-6xl" : "text-5xl"} mb-2 mt-2`}>
                        {agent.avatar}
                      </div>
                      <div className="text-lg font-[family-name:var(--font-kalam)] font-bold truncate">
                        {s.crown} {agent.name}
                      </div>
                      <div className="text-3xl font-[family-name:var(--font-kalam)] font-bold mt-1" style={{ color: s.border }}>
                        {agent.elo}
                      </div>
                      <div className="text-xs text-foreground/50 mt-1">
                        {agent.totalGames} 场 · 胜率 {Math.round(agent.winRate * 100)}%
                      </div>
                      {agent.tags.length > 0 && (
                        <div className="flex justify-center gap-1 mt-1.5">
                          {agent.tags.slice(0, 2).map((t) => (
                            <span key={t} className="text-xs text-foreground/30">#{t}</span>
                          ))}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Regular list (skip top 3 on first page) */}
            <div className="space-y-3">
              {agents.slice(page === 1 ? 3 : 0).map((agent, i) => {
                const rank = page === 1 ? i + 4 : (page - 1) * 20 + i + 1;
                const rs = getRankStyle(rank);
                return (
                  <Link
                    key={agent.id}
                    href={`/agent/${agent.id}`}
                    className="flex items-center gap-4 p-4 border-2 border-ink/60 transition-all duration-100 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:border-ink group"
                    style={{
                      borderRadius: WOBBLY_SM,
                      backgroundColor: rs.bg,
                      ...hardShadowSm,
                    }}
                  >
                    {/* Rank */}
                    <div className="w-10 text-center flex-shrink-0">
                      <span className="text-lg font-[family-name:var(--font-kalam)] font-bold text-foreground/40">
                        {rank}
                      </span>
                    </div>

                    {/* Avatar + Name */}
                    <div className="text-3xl flex-shrink-0">{agent.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-[family-name:var(--font-kalam)] font-bold text-lg truncate">
                          {agent.name}
                        </span>
                        {agent.isSystem && (
                          <span
                            className="text-xs px-2 py-0.5 border border-blue-400 text-blue-600 bg-blue-50"
                            style={{ borderRadius: WOBBLY_PILL }}
                          >
                            内置
                          </span>
                        )}
                        {agent.playMode === "autonomous" && (
                          <span
                            className="text-xs px-2 py-0.5 border border-purple-400 text-purple-600 bg-purple-50"
                            style={{ borderRadius: WOBBLY_PILL }}
                          >
                            自主
                          </span>
                        )}
                      </div>
                      {agent.bio && (
                        <div className="text-xs text-foreground/40 truncate">{agent.bio}</div>
                      )}
                      {agent.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {agent.tags.slice(0, 3).map((t) => (
                            <span key={t} className="text-xs text-foreground/30">#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 flex-shrink-0 text-right">
                      <div>
                        <div className="text-2xl font-[family-name:var(--font-kalam)] font-bold" style={{ color: "#e6a817" }}>
                          {agent.elo}
                        </div>
                        <div className="text-xs text-foreground/40">ELO</div>
                      </div>
                      <div className="hidden sm:block">
                        <div className="text-lg font-[family-name:var(--font-kalam)] font-bold">
                          {Math.round(agent.winRate * 100)}%
                        </div>
                        <div className="text-xs text-foreground/40">胜率</div>
                      </div>
                      <div className="hidden md:block">
                        <div className="text-lg font-[family-name:var(--font-kalam)] font-bold text-foreground/60">
                          {agent.totalGames}
                        </div>
                        <div className="text-xs text-foreground/40">场次</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 border-2 border-ink bg-white disabled:opacity-30 transition-colors hover:bg-gray-50"
              style={{ borderRadius: WOBBLY_SM }}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-foreground/50">
              第 <span className="font-[family-name:var(--font-kalam)] font-bold text-foreground">{page}</span> / {pagination.pages} 页
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="p-2 border-2 border-ink bg-white disabled:opacity-30 transition-colors hover:bg-gray-50"
              style={{ borderRadius: WOBBLY_SM }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
