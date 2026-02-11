"use client";
import { ROLE_LABELS } from "@/app/constants";
import { WINNER_CONFIG } from "@/app/design-v2";
import type { PlayerInfo } from "./types";

export function GameOverBanner({
  winner,
  players,
}: {
  winner: string;
  players: PlayerInfo[];
}) {
  const wc = WINNER_CONFIG[winner as keyof typeof WINNER_CONFIG] ?? WINNER_CONFIG.draw;

  return (
    <div className="card p-6 mb-6 text-center">
      <div className="text-5xl mb-3">
        {winner === "werewolf" ? "🐺" : winner === "draw" ? "⚠️" : "🏆"}
      </div>
      <div className="text-2xl font-bold mb-2" style={{ color: wc.color }}>
        {winner === "werewolf" ? "狼人阵营获胜！" : winner === "draw" ? "游戏异常终止（不计分）" : "好人阵营获胜！"}
      </div>
      <div className="flex justify-center gap-2 flex-wrap mt-4">
        {players.map((p) => (
          <div
            key={p.id}
            className={`px-3 py-2 text-sm rounded-lg border ${
              p.isAlive
                ? "bg-surface border-border"
                : "bg-surface/50 border-border opacity-50"
            }`}
          >
            <span className="mr-1">
              {p.parsedPersonality?.avatar ?? "🎭"}
            </span>
            <span className={!p.isAlive ? "line-through text-text-muted" : ""}>
              {p.agentName}
            </span>
            {p.role && (
              <span className="ml-2 text-xs text-text-muted">
                {ROLE_LABELS[p.role] ?? p.role}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
