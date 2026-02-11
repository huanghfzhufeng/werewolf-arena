"use client";
import { ROLE_LABELS } from "@/app/constants";
import type { PlayerInfo } from "./types";

export function PlayerSidebar({
  players,
  thinkingPlayerId,
}: {
  players: PlayerInfo[];
  thinkingPlayerId: string | null;
}) {
  return (
    <div className="lg:col-span-1 space-y-2">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
        🎭 玩家
      </h2>

      {/* Mobile: horizontal scroll strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
        {players.map((player) => {
          const pers = player.parsedPersonality;
          const isThinking = thinkingPlayerId === player.id;
          return (
            <div
              key={player.id}
              className={`flex-shrink-0 w-16 p-2 text-center rounded-lg border transition-colors ${
                !player.isAlive
                  ? "bg-surface/50 border-border opacity-50"
                  : isThinking
                    ? "bg-villager/5 border-villager"
                    : "bg-surface border-border"
              }`}
            >
              <div className="text-xl">
                {!player.isAlive ? "💀" : pers?.avatar ?? "🎭"}
              </div>
              <div className={`text-[10px] truncate mt-0.5 ${!player.isAlive ? "line-through text-text-muted" : ""}`}>
                {player.agentName}
              </div>
              {isThinking && (
                <div className="text-[9px] text-villager animate-pulse">思考中</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: vertical card list */}
      <div className="hidden lg:block space-y-2">
        {players.map((player) => {
          const pers = player.parsedPersonality;
          const isThinking = thinkingPlayerId === player.id;
          return (
            <div
              key={player.id}
              className={`p-3 rounded-xl border transition-all ${
                !player.isAlive
                  ? "bg-surface/50 border-border opacity-50"
                  : isThinking
                    ? "bg-villager/5 border-villager"
                    : "bg-surface border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {!player.isAlive ? "💀" : pers?.avatar ?? "🎭"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span
                      className={`font-medium text-sm truncate ${
                        !player.isAlive ? "line-through text-text-muted" : ""
                      }`}
                    >
                      {player.agentName}
                    </span>
                    {isThinking && (
                      <span className="text-xs text-villager animate-pulse">
                        思考中…
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted truncate">
                    {pers ? `${pers.series}` : `座位 ${player.seatNumber}`}
                  </div>
                  {pers?.catchphrase && player.isAlive && (
                    <div className="text-xs text-text-muted italic truncate mt-0.5">
                      「{pers.catchphrase}」
                    </div>
                  )}
                </div>
              </div>
              {player.role && (
                <div className="mt-1 text-xs text-text-muted ml-9">
                  {ROLE_LABELS[player.role] ?? player.role}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
