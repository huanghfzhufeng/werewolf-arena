"use client";
import { useRef, useEffect } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { WOBBLY_MD, WOBBLY_SM, hardShadowSm } from "@/app/design";
import type { FeedItem, PlayerInfo } from "./types";

function RoundSeparator({ round }: { round: number }) {
  return (
    <div className="flex items-center gap-3 py-2 my-1">
      <div className="flex-1 border-t-2 border-dashed border-ink/15" />
      <span className="text-xs font-[family-name:var(--font-kalam)] font-bold text-foreground/35 whitespace-nowrap">
        第 {round} 轮
      </span>
      <div className="flex-1 border-t-2 border-dashed border-ink/15" />
    </div>
  );
}

export function ChatFeed({
  feed,
  players,
  thinkingPlayerId,
  showPrivate,
  setShowPrivate,
  showGodView,
  setShowGodView,
  gameStatus,
}: {
  feed: FeedItem[];
  players: PlayerInfo[];
  thinkingPlayerId: string | null;
  showPrivate: boolean;
  setShowPrivate: (v: boolean) => void;
  showGodView: boolean;
  setShowGodView: (v: boolean) => void;
  gameStatus: string;
}) {
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed]);

  const getPlayer = (id?: string) => players.find((p) => p.id === id);
  const getAvatar = (id?: string) => getPlayer(id)?.parsedPersonality?.avatar ?? "🎭";

  const thinkingPlayerInfo = thinkingPlayerId ? getPlayer(thinkingPlayerId) : null;

  const filteredFeed = feed.filter((item) => {
    if (item.isPrivate && !showPrivate) return false;
    if (item.kind === "seer_result" && !showGodView && gameStatus !== "finished") return false;
    return true;
  });

  let lastRound = -1;

  return (
    <div className="lg:col-span-3">
      <div
        className="bg-white border-2 border-ink p-4"
        style={{ borderRadius: WOBBLY_MD, ...hardShadowSm }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-[family-name:var(--font-kalam)] font-bold text-lg">
            📜 对局实况
          </h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-foreground/50 cursor-pointer">
              <input
                type="checkbox"
                checked={showPrivate}
                onChange={(e) => setShowPrivate(e.target.checked)}
                className="w-3.5 h-3.5 accent-accent"
              />
              狼人密语
            </label>
            <label className="flex items-center gap-1.5 text-xs text-foreground/50 cursor-pointer">
              <input
                type="checkbox"
                checked={showGodView}
                onChange={(e) => setShowGodView(e.target.checked)}
                className="w-3.5 h-3.5 accent-blue"
              />
              {showGodView ? <Eye size={12} strokeWidth={2.5} /> : <EyeOff size={12} strokeWidth={2.5} />}
              上帝视角
            </label>
          </div>
        </div>

        <div className="max-h-[60vh] md:max-h-[550px] overflow-y-auto space-y-2 pr-1 notebook-lines">
          {filteredFeed.map((item) => {
            const speaker = getPlayer(item.playerId);

            // Round separator
            let separator = null;
            if (item.round > lastRound && item.round > 0) {
              separator = <RoundSeparator key={`round-${item.round}`} round={item.round} />;
            }
            lastRound = item.round;

            // Atmosphere
            if (item.kind === "atmosphere") {
              return (
                <div key={item.id}>
                  {separator}
                  <div className="text-center py-3 text-sm text-foreground/40 italic">
                    <Sparkles size={14} className="inline mr-1" strokeWidth={2.5} />
                    {item.content}
                  </div>
                </div>
              );
            }

            // System
            if (item.kind === "system") {
              return (
                <div key={item.id}>
                  {separator}
                  <div className="text-center py-2 text-sm font-medium" style={{ color: "#e6a817" }}>
                    {item.content}
                  </div>
                </div>
              );
            }

            // Vote
            if (item.kind === "vote") {
              const reason = item.extra?.reason as string | undefined;
              return (
                <div key={item.id}>
                  {separator}
                  <div className="py-1 px-3">
                    <div className="flex items-center gap-2 text-xs text-foreground/50">
                      <span>{getAvatar(item.playerId)}</span>
                      <span className="font-medium text-foreground/70">{speaker?.agentName}</span>
                      <span>➡️ {item.content}</span>
                    </div>
                    {reason && (
                      <div className="text-xs text-foreground/40 ml-7 mt-0.5 italic">
                        「{reason}」
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Last words
            if (item.kind === "last_words") {
              return (
                <div key={item.id}>
                  {separator}
                  <div className="flex gap-2 py-1 my-1">
                    <span className="text-xl flex-shrink-0 mt-0.5">{getAvatar(item.playerId)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-medium text-sm text-accent">
                          {speaker?.agentName ?? "???"}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/30"
                          style={{ borderRadius: WOBBLY_SM }}
                        >
                          遗言
                        </span>
                      </div>
                      <div
                        className="text-sm leading-relaxed px-3 py-2 inline-block max-w-full bg-accent/5 border-2 border-accent/30 text-foreground/70 italic"
                        style={{ borderRadius: WOBBLY_SM }}
                      >
                        {item.content}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Seer result
            if (item.kind === "seer_result") {
              return (
                <div key={item.id}>
                  {separator}
                  <div className="flex items-center gap-2 py-1 px-3 text-xs">
                    <span>🔮</span>
                    <span className="text-blue">{item.content}</span>
                    <span className="text-foreground/30">(上帝视角)</span>
                  </div>
                </div>
              );
            }

            // Vote tally
            if (item.kind === "vote_tally") {
              const tally = (item.extra?.tally ?? []) as Array<{
                targetName: string;
                count: number;
                voters: string[];
              }>;
              return (
                <div key={item.id}>
                  {separator}
                  <div
                    className="bg-muted/30 border-2 border-ink/20 p-4 my-2"
                    style={{ borderRadius: WOBBLY_SM }}
                  >
                    <div className="text-xs font-[family-name:var(--font-kalam)] font-bold text-foreground/60 mb-2">
                      🗳️ 投票统计
                    </div>
                    {tally
                      .sort((a, b) => b.count - a.count)
                      .map((t, ti) => (
                        <div key={`${t.targetName}-${ti}`} className="mb-1.5">
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="text-foreground/70">{t.targetName}</span>
                            <span className="text-foreground/40">
                              {t.count} 票（{t.voters.join("、")}）
                            </span>
                          </div>
                          <div className="progress-hand">
                            <div
                              className="progress-hand-fill"
                              style={{
                                width: `${Math.min(
                                  (t.count / Math.max(...tally.map((x) => x.count), 1)) * 100,
                                  100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              );
            }

            // Regular message (speech bubble)
            return (
              <div key={item.id}>
                {separator}
                <div className={`flex gap-2 py-1 ${item.isPrivate ? "opacity-70" : ""}`}>
                  <span className="text-xl flex-shrink-0 mt-0.5">{getAvatar(item.playerId)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-medium text-sm text-blue">
                        {speaker?.agentName ?? "???"}
                      </span>
                      {item.isPrivate && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 border border-purple-300"
                          style={{ borderRadius: WOBBLY_SM }}
                        >
                          密语
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-sm leading-relaxed px-3 py-2 inline-block max-w-full border-2 ${
                        item.isPrivate
                          ? "bg-purple-50 border-purple-300/50 text-purple-900"
                          : "bg-white border-ink/20 text-foreground/80"
                      }`}
                      style={{ borderRadius: WOBBLY_SM }}
                    >
                      {item.content}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Thinking indicator */}
          {thinkingPlayerInfo && (
            <div className="flex gap-2 py-1 animate-pulse">
              <span className="text-xl flex-shrink-0 mt-0.5">
                {thinkingPlayerInfo.parsedPersonality?.avatar ?? "🎭"}
              </span>
              <div>
                <div className="text-sm text-foreground/50 mb-0.5">
                  {thinkingPlayerInfo.agentName}
                </div>
                <div
                  className="bg-muted/30 border-2 border-dashed border-ink/20 px-3 py-2 inline-block"
                  style={{ borderRadius: WOBBLY_SM }}
                >
                  <span className="text-foreground/40 text-sm">
                    思考中
                    <span className="animate-pulse">……</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {feed.length === 0 && !thinkingPlayerId && (
            <div className="text-foreground/30 text-center py-12">
              <div className="text-2xl mb-2 animate-bounce-gentle">📝</div>
              等待游戏开始...
            </div>
          )}

          <div ref={feedEndRef} />
        </div>
      </div>
    </div>
  );
}
