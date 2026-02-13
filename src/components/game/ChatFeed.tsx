"use client";
import { useRef, useEffect } from "react";
import { Sparkles } from "lucide-react";
import type { FeedItem, PlayerInfo } from "./types";

function RoundSeparator({ round }: { round: number }) {
  return (
    <div className="flex items-center gap-3 py-2 my-1">
      <div className="flex-1 border-t border-border" />
      <span className="text-xs font-semibold text-text-muted whitespace-nowrap">
        第 {round} 轮
      </span>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

export function ChatFeed({
  feed,
  players,
  thinkingPlayerId,
}: {
  feed: FeedItem[];
  players: PlayerInfo[];
  thinkingPlayerId: string | null;
}) {
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed]);

  const getPlayer = (id?: string) => players.find((p) => p.id === id);
  const getAvatar = (id?: string) => getPlayer(id)?.parsedPersonality?.avatar ?? "🎭";

  const thinkingPlayerInfo = thinkingPlayerId ? getPlayer(thinkingPlayerId) : null;

  return (
    <div className="lg:col-span-3">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-base">
            📜 对局实况
          </h2>
        </div>

        <div className="max-h-[60vh] md:max-h-[550px] overflow-y-auto space-y-2 pr-1">
          {feed.map((item, index) => {
            const speaker = getPlayer(item.playerId);
            const previousRound = index > 0 ? feed[index - 1]?.round ?? -1 : -1;

            // Round separator
            const separator =
              item.round > previousRound && item.round > 0
                ? <RoundSeparator key={`round-${item.round}`} round={item.round} />
                : null;

            // Atmosphere
            if (item.kind === "atmosphere") {
              return (
                <div key={item.id}>
                  {separator}
                  <div className="text-center py-3 text-sm text-text-muted italic">
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
                  <div className="text-center py-2 text-sm font-medium" style={{ color: "var(--gold)" }}>
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
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span>{getAvatar(item.playerId)}</span>
                      <span className="font-medium text-text-secondary">{speaker?.agentName}</span>
                      <span>➡️ {item.content}</span>
                    </div>
                    {reason && (
                      <div className="text-xs text-text-muted ml-7 mt-0.5 italic">
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
                        <span className="font-medium text-sm text-wolf">
                          {speaker?.agentName ?? "???"}
                        </span>
                        <span className="badge" style={{ color: "var(--wolf)", borderColor: "var(--wolf)", background: "rgba(239,68,68,0.1)" }}>
                          遗言
                        </span>
                      </div>
                      <div className="text-sm leading-relaxed px-3 py-2 inline-block max-w-full rounded-lg border border-wolf/20 bg-wolf/5 text-text-secondary italic">
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
                    <span className="text-villager">{item.content}</span>
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
                  <div className="bg-surface-hover rounded-xl p-4 my-2">
                    <div className="text-xs font-semibold text-text-muted mb-2">
                      🗳️ 投票统计
                    </div>
                    {tally
                      .sort((a, b) => b.count - a.count)
                      .map((t, ti) => (
                        <div key={`${t.targetName}-${ti}`} className="mb-1.5">
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="text-text-secondary">{t.targetName}</span>
                            <span className="text-text-muted">
                              {t.count} 票（{t.voters.join("、")}）
                            </span>
                          </div>
                          <div className="progress-bar">
                            <div
                              className="progress-bar-fill"
                              style={{
                                width: `${Math.min(
                                  (t.count / Math.max(...tally.map((x) => x.count), 1)) * 100,
                                  100,
                                )}%`,
                                background: "var(--gold)",
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
                      <span className="font-medium text-sm text-villager">
                        {speaker?.agentName ?? "???"}
                      </span>
                      {item.isPrivate && (
                        <span className="badge" style={{ color: "#a855f7", borderColor: "#a855f7", background: "rgba(168,85,247,0.1)" }}>
                          密语
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-sm leading-relaxed px-3 py-2 inline-block max-w-full rounded-lg border ${
                        item.isPrivate
                          ? "bg-purple-500/10 border-purple-500/20 text-purple-300"
                          : "bg-surface border-border text-text-secondary"
                      }`}
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
                <div className="text-sm text-text-muted mb-0.5">
                  {thinkingPlayerInfo.agentName}
                </div>
                <div className="bg-surface-hover border border-dashed border-border rounded-lg px-3 py-2 inline-block">
                  <span className="text-text-muted text-sm">
                    思考中
                    <span className="animate-pulse">……</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {feed.length === 0 && !thinkingPlayerId && (
            <div className="text-text-muted text-center py-12">
              <div className="text-2xl mb-2">📝</div>
              等待游戏开始...
            </div>
          )}

          <div ref={feedEndRef} />
        </div>
      </div>
    </div>
  );
}
