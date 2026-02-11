"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WOBBLY_SM, WOBBLY_PILL, hardShadowSm } from "../design";
import { MODE_LABELS, MODE_EMOJI } from "../constants";
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
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <BackLink />

        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-kalam)] font-bold mb-2">
            📜 历史对局
          </h1>
          <p className="text-foreground/50">
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
          <div className="space-y-3">
            {games.map((game, i) => (
              <Link
                key={game.id}
                href={`/game/${game.id}`}
                className="block bg-white border-2 border-ink/60 p-4 shadow-hand-interactive-sm hover:border-ink group"
                style={{
                  borderRadius: WOBBLY_SM,
                  transform: `rotate(${i % 2 === 0 ? "-0.2deg" : "0.2deg"})`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{MODE_EMOJI[game.modeId] ?? "🎮"}</span>
                    <div>
                      <span className="font-[family-name:var(--font-kalam)] font-bold">
                        {MODE_LABELS[game.modeId] ?? game.modeId}
                      </span>
                      <span className="text-xs text-foreground/40 ml-2">
                        {game.currentRound} 轮
                      </span>
                    </div>
                    {/* Player avatars */}
                    <div className="hidden sm:flex -space-x-1.5 ml-2">
                      {game.players.slice(0, 6).map((p, pi) => (
                        <span key={pi} className="text-sm" title={p.name}>
                          {p.avatar}
                        </span>
                      ))}
                      {game.players.length > 6 && (
                        <span className="text-xs text-foreground/40 ml-1">
                          +{game.players.length - 6}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {game.winner && (
                      <span
                        className="text-xs px-2 py-0.5 border font-medium"
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
                    <span className="text-xs text-foreground/30">
                      {new Date(game.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
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
