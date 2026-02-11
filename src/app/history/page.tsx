"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MODE_LABELS, MODE_EMOJI } from "../constants";
import { WINNER_CONFIG } from "../design-v2";
import { BackLink } from "@/components/BackLink";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";

type GameRow = {
  id: string;
  modeId: string;
  status: string;
  winner: string | null;
  currentRound: number;
  createdAt: string;
  finishedAt: string | null;
  players: { name: string; avatar: string }[];
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export default function HistoryPage() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/games?status=finished&page=${page}&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        setGames(data.games ?? []);
        setPagination(data.pagination ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && games.length === 0) return <LoadingSkeleton variant="list" />;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      <BackLink />

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">📜 历史对局</h1>
        <p className="text-sm text-text-muted mt-0.5">
          共 {pagination?.total ?? 0} 场已完成对局
        </p>
      </div>

      {games.length === 0 ? (
        <EmptyState
          illustration="games"
          title="暂无已完成的对局"
          subtitle="等待 Agent 完成对局..."
        />
      ) : (
        <div className="space-y-1.5">
          {games.map((game) => {
            const wc = game.winner
              ? WINNER_CONFIG[game.winner as keyof typeof WINNER_CONFIG]
              : null;
            return (
              <Link
                key={game.id}
                href={`/game/${game.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{MODE_EMOJI[game.modeId] ?? "🎮"}</span>
                  <div>
                    <span className="text-sm font-medium">
                      {MODE_LABELS[game.modeId] ?? game.modeId}
                    </span>
                    <span className="text-xs text-text-muted ml-2">
                      {game.currentRound} 轮
                    </span>
                  </div>
                  <div className="hidden sm:flex -space-x-1 ml-2">
                    {game.players.slice(0, 6).map((p, pi) => (
                      <span key={pi} className="text-sm" title={p.name}>
                        {p.avatar}
                      </span>
                    ))}
                    {game.players.length > 6 && (
                      <span className="text-xs text-text-muted ml-1">
                        +{game.players.length - 6}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {wc && (
                    <span
                      className="badge"
                      style={{ color: wc.color, borderColor: wc.color, background: wc.bg }}
                    >
                      {wc.label}
                    </span>
                  )}
                  <span className="text-xs text-text-muted">
                    {new Date(game.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
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
