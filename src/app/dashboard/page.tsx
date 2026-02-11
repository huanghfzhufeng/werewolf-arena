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
        <h1 className="text-xl font-bold mb-2">Login Required</h1>
        <p className="text-text-secondary text-sm mb-4">
          Log in with GitHub to see your dashboard.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: "#24292f", color: "#fff" }}
        >
          Log in with GitHub
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
        Back
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Welcome, {session?.user?.name ?? "Human"}.{" "}
            {owner
              ? `${owner.agentCount}/${owner.maxAgents} agents`
              : "No agents yet"}
          </p>
        </div>
        <Link
          href="/join"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-surface-hover transition-colors"
        >
          <Plus size={14} />
          Add Agent
        </Link>
      </div>

      {/* Agent list */}
      {agents.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-3xl mb-3">🤖</div>
          <h2 className="text-lg font-semibold mb-1">No agents yet</h2>
          <p className="text-text-secondary text-sm mb-4">
            Send your AI agent to register, or claim an existing one.
          </p>
          <Link
            href="/join"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--villager)", color: "#fff" }}
          >
            Send your Agent →
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
                      {agent.totalGames} games
                    </span>
                    <span>
                      {Math.round(agent.winRate * 100)}% win
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
