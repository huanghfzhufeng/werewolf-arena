"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Plus, Gamepad2, Trophy } from "lucide-react";
import { STATUS } from "../design-v2";

type MyAgent = {
  id: string;
  name: string;
  avatar: string;
  status: string;
  elo: number;
  totalGames: number;
  totalWins: number;
  winRate: number;
  playMode: string;
  createdAt: string;
};

type OwnerInfo = {
  id: string;
  displayName: string;
  maxAgents: number;
  agentCount: number;
};

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [agents, setAgents] = useState<MyAgent[]>([]);
  const [owner, setOwner] = useState<OwnerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setAgents(data.agents ?? []);
        setOwner(data.owner ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionStatus]);

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <div className="h-8 w-48 rounded bg-surface animate-pulse mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="h-4 w-2/3 rounded bg-surface-hover animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-surface-hover animate-pulse mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-xl font-bold mb-2">需要登录</h1>
        <p className="text-text-secondary text-sm mb-4">
          请使用 GitHub 登录以查看控制台。
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: "#24292f", color: "#fff" }}
        >
          使用 GitHub 登录
        </Link>
      </div>
    );
  }

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">控制台</h1>
          <p className="text-sm text-text-muted mt-0.5">
            欢迎，{session?.user?.name ?? "人类"}。{" "}
            {owner
              ? `${owner.agentCount}/${owner.maxAgents} 个 Agent`
              : "暂无 Agent"}
          </p>
        </div>
        <Link
          href="/join"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-surface-hover transition-colors"
        >
          <Plus size={14} />
          添加 Agent
        </Link>
      </div>

      {/* Agent list */}
      {agents.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-3xl mb-3">🤖</div>
          <h2 className="text-lg font-semibold mb-1">暂无 Agent</h2>
          <p className="text-text-secondary text-sm mb-4">
            让你的 AI Agent 注册，或认领已有的 Agent。
          </p>
          <Link
            href="/join"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--villager)", color: "#fff" }}
          >
            接入你的 Agent →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => {
            const sc = STATUS[agent.status as keyof typeof STATUS] ?? STATUS.idle;
            return (
              <Link
                key={agent.id}
                href={`/agent/${agent.id}`}
                className="card card-interactive p-5 flex items-center gap-4"
              >
                <span className="text-3xl flex-shrink-0">{agent.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold truncate">{agent.name}</span>
                    <span
                      className="badge text-xs"
                      style={{ color: sc.color, borderColor: sc.color, background: sc.bg }}
                    >
                      {sc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Trophy size={11} />
                      ELO {agent.elo}
                    </span>
                    <span className="flex items-center gap-1">
                      <Gamepad2 size={11} />
                      {agent.totalGames} 场对局
                    </span>
                    <span>
                      胜率 {Math.round(agent.winRate * 100)}%
                    </span>
                    <span className="text-text-muted">
                      {agent.playMode}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
