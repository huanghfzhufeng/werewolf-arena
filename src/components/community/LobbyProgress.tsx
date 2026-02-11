"use client";
import { WOBBLY_MD, WOBBLY_SM, hardShadowSm } from "@/app/design";
import { MODE_EMOJI } from "@/app/constants";

type ModeInfo = {
  id: string;
  nameZh: string;
  playerCount: number;
  descriptionZh: string;
};

type LobbyInfo = {
  id: string;
  modeId: string;
  currentPlayers: number;
  requiredPlayers: number;
  members: { id: string; name: string; avatar: string }[];
};

export function LobbyProgress({
  modes,
  lobbies,
}: {
  modes: ModeInfo[];
  lobbies: LobbyInfo[];
}) {
  const rotations = ["-1deg", "0.5deg", "-0.5deg", "1deg", "-0.8deg"];

  return (
    <section>
      <h2 className="text-xl font-[family-name:var(--font-kalam)] font-bold mb-4">
        🏟️ 排队大厅
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modes.map((mode, i) => {
          const lobby = lobbies.find((l) => l.modeId === mode.id);
          const current = lobby?.currentPlayers ?? 0;
          const required = lobby?.requiredPlayers ?? mode.playerCount;
          const progress = required > 0 ? (current / required) * 100 : 0;

          return (
            <div
              key={mode.id}
              className="border-2 border-ink p-5 tape transition-transform duration-100 hover:scale-[1.02]"
              style={{
                borderRadius: WOBBLY_MD,
                backgroundColor: "#fff9c4",
                transform: `rotate(${rotations[i % rotations.length]})`,
                ...hardShadowSm,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{MODE_EMOJI[mode.id] ?? "🎮"}</span>
                <div>
                  <div className="font-[family-name:var(--font-kalam)] font-bold text-base">
                    {mode.nameZh}
                  </div>
                  <div className="text-xs text-foreground/50">{mode.playerCount} 人</div>
                </div>
              </div>
              <div className="text-xs text-foreground/50 mb-3">{mode.descriptionZh}</div>

              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-foreground/50">排队中</span>
                <span className="font-[family-name:var(--font-kalam)] font-bold">
                  {current}/{required}
                </span>
              </div>
              <div className="progress-hand">
                <div
                  className="progress-hand-fill"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>

              {lobby && lobby.members.length > 0 && (
                <div className="flex -space-x-2 mt-3">
                  {lobby.members.map((m) => (
                    <span
                      key={m.id}
                      className="inline-block w-7 h-7 bg-white border-2 border-ink text-center leading-7 text-sm"
                      style={{ borderRadius: WOBBLY_SM }}
                      title={m.name}
                    >
                      {m.avatar}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
