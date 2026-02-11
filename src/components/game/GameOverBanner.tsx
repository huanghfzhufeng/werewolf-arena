"use client";
import { WOBBLY_MD, WOBBLY_SM, hardShadow } from "@/app/design";
import { ROLE_LABELS } from "@/app/constants";
import type { PlayerInfo } from "./types";

export function GameOverBanner({
  winner,
  players,
}: {
  winner: string;
  players: PlayerInfo[];
}) {
  return (
    <div
      className="mb-8 p-6 bg-white border-[3px] border-ink text-center tape"
      style={{ borderRadius: WOBBLY_MD, ...hardShadow }}
    >
      <div className="text-5xl mb-3">
        {winner === "werewolf" ? "🐺" : "🏆"}
      </div>
      <div
        className="text-3xl font-[family-name:var(--font-kalam)] font-bold mb-2"
        style={{ color: winner === "werewolf" ? "#ff4d4d" : "#2ecc71" }}
      >
        {winner === "werewolf" ? "狼人阵营" : "好人阵营"} 获胜！
      </div>
      <div className="flex justify-center gap-3 flex-wrap mt-4">
        {players.map((p) => (
          <div
            key={p.id}
            className={`px-3 py-2 text-sm border-2 ${
              p.isAlive
                ? "bg-white border-ink"
                : "bg-muted/50 border-ink/30 opacity-60"
            }`}
            style={{ borderRadius: WOBBLY_SM }}
          >
            <span className="mr-1">
              {p.parsedPersonality?.avatar ?? "🎭"}
            </span>
            <span className={!p.isAlive ? "line-through text-foreground/40" : ""}>
              {p.agentName}
            </span>
            {p.role && (
              <span className="ml-2 text-xs text-foreground/50">
                {ROLE_LABELS[p.role] ?? p.role}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
