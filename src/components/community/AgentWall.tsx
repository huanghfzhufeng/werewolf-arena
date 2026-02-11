"use client";
import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { WOBBLY_SM, WOBBLY_PILL, hardShadowSm } from "@/app/design";
import { STATUS_CONFIG } from "@/app/constants";

type AgentBrief = {
  id: string;
  name: string;
  avatar: string;
  status: string;
  elo: number;
  isSystem: boolean;
};

const FILTER_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "idle", label: "空闲" },
  { value: "queued", label: "排队" },
  { value: "playing", label: "对局" },
];

export function AgentWall({ agents }: { agents: AgentBrief[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = agents
    .filter((a) => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => b.elo - a.elo);

  return (
    <section>
      <h2 className="text-xl font-[family-name:var(--font-kalam)] font-bold mb-4 flex items-center gap-2">
        🎭 Agent 社区
        <span className="text-sm font-normal text-foreground/40">
          ({agents.length})
        </span>
      </h2>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" />
          <input
            type="text"
            placeholder="搜索 Agent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border-2 border-ink/30 bg-white focus:border-ink focus:outline-none"
            style={{ borderRadius: WOBBLY_SM }}
          />
        </div>
        <div className="flex gap-1.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className="px-3 py-1 text-xs font-medium border-2 transition-all duration-100"
              style={{
                borderRadius: WOBBLY_PILL,
                backgroundColor: statusFilter === opt.value ? "#2d2d2d" : "#fff",
                color: statusFilter === opt.value ? "#fff" : "#2d2d2d",
                borderColor: "#2d2d2d",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {filtered.map((agent) => {
          const sc = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.idle;
          return (
            <Link
              key={agent.id}
              href={`/agent/${agent.id}`}
              className="bg-white border-2 border-ink p-3 text-center transition-all duration-100 hover:rotate-1 hover:translate-x-[-2px] hover:translate-y-[-2px] group"
              style={{ borderRadius: WOBBLY_SM, ...hardShadowSm }}
            >
              <div className="text-3xl mb-1 group-hover:scale-110 transition-transform duration-100">
                {agent.avatar}
              </div>
              <div className="text-sm font-medium truncate">{agent.name}</div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: sc.color }}
                />
                <span className="text-xs text-foreground/50">{sc.label}</span>
              </div>
              <div className="text-xs font-[family-name:var(--font-kalam)] font-bold mt-0.5" style={{ color: "#e6a817" }}>
                {agent.elo}
              </div>
              {!agent.isSystem && (
                <div className="text-[10px] text-purple-400 mt-0.5">外部</div>
              )}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-foreground/40">
          没有匹配的 Agent
        </div>
      )}
    </section>
  );
}
