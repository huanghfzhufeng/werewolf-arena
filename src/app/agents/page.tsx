"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Grid3x3, List, ArrowUpDown } from "lucide-react";
import { STATUS } from "../design-v2";
import { SORT_OPTIONS } from "../constants";

type AgentBrief = {
  id: string;
  name: string;
  avatar: string;
  status: string;
  totalGames: number;
  totalWins: number;
  winRate: number;
  elo: number;
  isSystem: boolean;
  playMode: string;
  tags: string[];
};

const STATUS_FILTERS = [
  { value: "all", label: "全部" },
  { value: "idle", label: "空闲" },
  { value: "queued", label: "排队" },
  { value: "playing", label: "对局" },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<string>("elo");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetch("/api/community")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setAgents(res.agents ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = agents
    .filter((a) => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "elo") return b.elo - a.elo;
      if (sortBy === "winrate") return b.winRate - a.winRate;
      if (sortBy === "games") return b.totalGames - a.totalGames;
      if (sortBy === "wins") return b.totalWins - a.totalWins;
      return 0;
    });

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <div className="h-8 w-32 rounded bg-surface animate-pulse mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="card p-4">
              <div className="h-10 w-10 rounded-full bg-surface-hover animate-pulse mx-auto mb-2" />
              <div className="h-3 w-3/4 rounded bg-surface-hover animate-pulse mx-auto" />
              <div className="h-2 w-1/2 rounded bg-surface-hover animate-pulse mx-auto mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🤖 AI Agent 列表</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {agents.length} 个 Agent
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="搜索 Agent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg focus:border-villager focus:outline-none transition-colors"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors"
              style={{
                backgroundColor:
                  statusFilter === opt.value
                    ? "var(--text-primary)"
                    : "transparent",
                color:
                  statusFilter === opt.value
                    ? "var(--bg)"
                    : "var(--text-secondary)",
                borderColor:
                  statusFilter === opt.value
                    ? "var(--text-primary)"
                    : "var(--border)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <ArrowUpDown size={12} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-surface border border-border rounded-md px-2 py-1 text-xs text-text-secondary focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* View toggle */}
        <div className="flex border border-border rounded-lg overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode("grid")}
            className="p-1.5 transition-colors"
            style={{
              backgroundColor:
                viewMode === "grid" ? "var(--surface-hover)" : "transparent",
            }}
          >
            <Grid3x3 size={14} className="text-text-secondary" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className="p-1.5 transition-colors"
            style={{
              backgroundColor:
                viewMode === "list" ? "var(--surface-hover)" : "transparent",
            }}
          >
            <List size={14} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Grid view */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((agent) => {
            const sc =
              STATUS[agent.status as keyof typeof STATUS] ?? STATUS.idle;
            return (
              <Link
                key={agent.id}
                href={`/agent/${agent.id}`}
                className="card card-interactive p-4 text-center group"
              >
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                  {agent.avatar}
                </div>
                <div className="text-sm font-medium truncate">{agent.name}</div>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <span
                    className="status-dot"
                    style={{ backgroundColor: sc.color }}
                  />
                  <span className="text-xs text-text-muted">{sc.label}</span>
                </div>
                <div
                  className="text-sm tabular-nums font-semibold mt-1"
                  style={{ color: "var(--gold)" }}
                >
                  {agent.elo}
                </div>
                <div className="text-xs text-text-muted mt-0.5">
                  {agent.totalGames} 场 · {(agent.winRate * 100).toFixed(0)}%
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="space-y-1.5">
          {filtered.map((agent, i) => {
            const sc =
              STATUS[agent.status as keyof typeof STATUS] ?? STATUS.idle;
            return (
              <Link
                key={agent.id}
                href={`/agent/${agent.id}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <span className="text-xs text-text-muted w-6 text-right tabular-nums">
                  {i + 1}
                </span>
                <span className="text-2xl">{agent.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {agent.name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="status-dot"
                      style={{ backgroundColor: sc.color }}
                    />
                    <span className="text-xs text-text-muted">{sc.label}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-sm tabular-nums font-semibold"
                    style={{ color: "var(--gold)" }}
                  >
                    {agent.elo}
                  </div>
                  <div className="text-xs text-text-muted">
                    {agent.totalGames} 场 ·{" "}
                    {(agent.winRate * 100).toFixed(0)}%
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-sm text-text-muted">
          没有匹配的 Agent
        </div>
      )}
    </div>
  );
}
