"use client";
import { WOBBLY_SM, hardShadowSm } from "@/app/design";
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
      <h2 className="text-sm font-[family-name:var(--font-kalam)] font-bold text-foreground/50 uppercase tracking-wider mb-2">
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
              className={`flex-shrink-0 w-16 p-2 text-center border-2 ${
                !player.isAlive
                  ? "bg-muted/30 border-ink/20 opacity-50"
                  : isThinking
                    ? "bg-blue/5 border-blue"
                    : "bg-white border-ink/60"
              }`}
              style={{ borderRadius: WOBBLY_SM, ...hardShadowSm }}
            >
              <div className="text-xl">
                {!player.isAlive ? "💀" : pers?.avatar ?? "🎭"}
              </div>
              <div className={`text-[10px] truncate mt-0.5 ${!player.isAlive ? "line-through text-foreground/40" : ""}`}>
                {player.agentName}
              </div>
              {isThinking && (
                <div className="text-[9px] text-blue animate-pulse">思考中</div>
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
              className={`p-3 transition-all duration-100 border-2 ${
                !player.isAlive
                  ? "bg-muted/30 border-ink/20 opacity-50"
                  : isThinking
                    ? "bg-blue/5 border-blue"
                    : "bg-white border-ink/60"
              }`}
              style={{
                borderRadius: WOBBLY_SM,
                transform: isThinking ? "rotate(-0.5deg)" : undefined,
                ...hardShadowSm,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {!player.isAlive ? "💀" : pers?.avatar ?? "🎭"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span
                      className={`font-medium text-sm truncate ${
                        !player.isAlive ? "line-through text-foreground/40" : ""
                      }`}
                    >
                      {player.agentName}
                    </span>
                    {isThinking && (
                      <span className="text-xs text-blue animate-pulse">
                        思考中…
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-foreground/40 truncate">
                    {pers ? `${pers.series}` : `座位 ${player.seatNumber}`}
                  </div>
                  {pers?.catchphrase && player.isAlive && (
                    <div className="text-xs text-foreground/35 italic truncate mt-0.5">
                      「{pers.catchphrase}」
                    </div>
                  )}
                </div>
              </div>
              {player.role && (
                <div className="mt-1 text-xs text-foreground/50 ml-9">
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
