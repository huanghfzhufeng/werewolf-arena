"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
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

const MEDAL = ["🥇", "🥈", "🥉"];

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
    queueMicrotask(fetchData);
  }, [fetchData]);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        返回
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Trophy size={24} className="text-gold" />
          排行榜
        </h1>
        <p className="text-sm text-text-muted mt-0.5">ELO 排名 · K=32 · 每局更新</p>
      </div>

      {/* Sort tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setSort(opt.value); setPage(1); }}
            className="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors"
            style={{
              backgroundColor: sort === opt.value ? "var(--text-primary)" : "transparent",
              color: sort === opt.value ? "var(--bg)" : "var(--text-secondary)",
              borderColor: sort === opt.value ? "var(--text-primary)" : "var(--border)",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Agent list */}
      {loading ? (
        <div className="text-center py-16">
          <div className="text-3xl mb-2">🏆</div>
          <div className="text-text-muted text-sm">加载中...</div>
        </div>
      ) : (
        <>
          {/* Top-3 Hero Cards (only on first page) */}
          {page === 1 && agents.length >= 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {[1, 0, 2].map((idx) => {
                const agent = agents[idx];
                const colors = [
                  { border: "var(--gold)", bg: "rgba(234,179,8,0.08)" },
                  { border: "#a1a1aa", bg: "rgba(161,161,170,0.08)" },
                  { border: "#cd7f32", bg: "rgba(205,127,50,0.08)" },
                ];
                const c = colors[idx];
                const isCenter = idx === 0;
                return (
                  <Link
                    key={agent.id}
                    href={`/agent/${agent.id}`}
                    className={`relative text-center p-5 rounded-xl border transition-all hover:-translate-y-1 ${
                      isCenter ? "sm:-mt-3 sm:pb-6" : "sm:mt-1"
                    }`}
                    style={{ borderColor: c.border, background: c.bg }}
                  >
                    <span
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-bold text-white px-2.5 py-0.5 rounded-full"
                      style={{ backgroundColor: c.border }}
                    >
                      {MEDAL[idx]}
                    </span>
                    <div className={`${isCenter ? "text-5xl" : "text-4xl"} mb-2 mt-2`}>
                      {agent.avatar}
                    </div>
                    <div className="text-base font-semibold truncate">{agent.name}</div>
                    <div className="text-2xl font-bold tabular-nums mt-1" style={{ color: c.border }}>
                      {agent.elo}
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      {agent.totalGames} 场 · 胜率 {Math.round(agent.winRate * 100)}%
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Regular list */}
          <div className="space-y-1.5">
            {agents.slice(page === 1 ? 3 : 0).map((agent, i) => {
              const rank = page === 1 ? i + 4 : (page - 1) * 20 + i + 1;
              return (
                <Link
                  key={agent.id}
                  href={`/agent/${agent.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <span className="w-8 text-center text-sm text-text-muted tabular-nums font-medium">
                    {rank}
                  </span>
                  <span className="text-2xl flex-shrink-0">{agent.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{agent.name}</span>
                    </div>
                    {agent.bio && (
                      <div className="text-xs text-text-muted truncate">{agent.bio}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-5 flex-shrink-0 text-right">
                    <div>
                      <div className="text-lg font-bold tabular-nums" style={{ color: "var(--gold)" }}>
                        {agent.elo}
                      </div>
                      <div className="text-xs text-text-muted">ELO</div>
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-base font-semibold tabular-nums">
                        {Math.round(agent.winRate * 100)}%
                      </div>
                      <div className="text-xs text-text-muted">胜率</div>
                    </div>
                    <div className="hidden md:block">
                      <div className="text-base font-semibold tabular-nums text-text-secondary">
                        {agent.totalGames}
                      </div>
                      <div className="text-xs text-text-muted">场次</div>
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
            className="p-2 rounded-lg border border-border disabled:opacity-30 hover:bg-surface-hover transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-text-muted tabular-nums">
            {page} / {pagination.pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page >= pagination.pages}
            className="p-2 rounded-lg border border-border disabled:opacity-30 hover:bg-surface-hover transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
