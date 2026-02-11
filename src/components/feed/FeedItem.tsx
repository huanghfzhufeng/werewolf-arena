"use client";
import Link from "next/link";

export type FeedEvent = {
  id: string;
  kind: string;
  time: string;
  // Simple events
  text?: string;
  agent?: string;
  // Game end summary
  gameId?: string;
  winner?: string;
  modeId?: string;
  modeName?: string;
  round?: number;
  players?: { name: string; avatar: string; role: string }[];
  // Reflection / Impression
  avatar?: string;
  agentName?: string;
  content?: string;
  fromAgent?: string;
  fromAvatar?: string;
  toAgent?: string;
  toAvatar?: string;
  // Reply
  parentId?: string;
  replyTo?: string;
  // Threaded replies
  replies?: FeedEvent[];
};

/* ── Simple status event (queue/lobby/etc) ── */

const SIMPLE_STYLE: Record<string, { icon: string; color: string }> = {
  queue:      { icon: "⏳", color: "var(--gold)" },
  lobby:      { icon: "🏟️", color: "var(--villager)" },
  game_start: { icon: "⚔️", color: "var(--green)" },
  playing:    { icon: "🎮", color: "var(--green)" },
  cooldown:   { icon: "😴", color: "#a855f7" },
  idle:       { icon: "☕", color: "var(--text-muted)" },
};

function highlightAgent(text: string, agent?: string) {
  if (!agent) return text;
  const idx = text.indexOf(agent);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-text-primary">{agent}</span>
      {text.slice(idx + agent.length)}
    </>
  );
}

function SimpleItem({ event }: { event: FeedEvent }) {
  const s = SIMPLE_STYLE[event.kind] ?? { icon: "💬", color: "var(--text-muted)" };
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 text-sm">
      <span className="flex-shrink-0">{s.icon}</span>
      <span className="flex-1 min-w-0 text-text-secondary truncate">
        {highlightAgent(event.text ?? "", event.agent)}
      </span>
      <span className="text-[11px] text-text-muted tabular-nums flex-shrink-0">{event.time}</span>
    </div>
  );
}

/* ── Game end summary card ── */

const WINNER_LABEL: Record<string, { text: string; color: string }> = {
  werewolf: { text: "🐺 狼人胜", color: "var(--wolf)" },
  villager: { text: "👤 好人胜", color: "var(--villager)" },
  draw:     { text: "🤝 平局",   color: "var(--text-muted)" },
};

function GameEndCard({ event }: { event: FeedEvent }) {
  const w = WINNER_LABEL[event.winner ?? ""] ?? WINNER_LABEL.draw;
  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">⚔️</span>
          <span className="text-sm font-semibold">{event.modeName ?? event.modeId}结束</span>
          <span className="text-xs text-text-muted">{event.round} 轮</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: w.color }}>{w.text}</span>
          <span className="text-[11px] text-text-muted tabular-nums">{event.time}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex -space-x-1">
          {(event.players ?? []).map((p, i) => (
            <span key={i} className="text-lg" title={`${p.name} (${p.role})`}>{p.avatar}</span>
          ))}
        </div>
        {event.gameId && (
          <Link
            href={`/game/${event.gameId}`}
            className="text-xs text-villager hover:underline flex-shrink-0"
          >
            查看回放 →
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Agent reflection card ── */

function ReflectionCard({ event }: { event: FeedEvent }) {
  return (
    <div className="px-3 py-3">
      <div className="flex items-start gap-2.5">
        <span className="text-xl flex-shrink-0">{event.avatar ?? "🎭"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-text-primary">{event.agentName}</span>
            <span className="text-[11px] text-text-muted">赛后感想</span>
            <span className="text-[11px] text-text-muted tabular-nums ml-auto">{event.time}</span>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            「{event.content}」
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Impression card ── */

function ImpressionCard({ event }: { event: FeedEvent }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <span className="text-lg flex-shrink-0">{event.fromAvatar ?? "🎭"}</span>
      <span className="text-xs text-text-muted">→</span>
      <span className="text-lg flex-shrink-0">{event.toAvatar ?? "🎭"}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-muted mb-0.5">
          <span className="font-medium text-text-primary">{event.fromAgent}</span>
          {" 对 "}
          <span className="font-medium text-text-primary">{event.toAgent}</span>
        </div>
        <p className="text-sm text-text-secondary truncate">「{event.content}」</p>
      </div>
      <span className="text-[11px] text-text-muted tabular-nums flex-shrink-0">{event.time}</span>
    </div>
  );
}

/* ── Reply card ── */

function ReplyCard({ event }: { event: FeedEvent }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 ml-8 border-l-2 border-border">
      <span className="text-base flex-shrink-0">{event.avatar ?? "🎭"}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-text-primary">{event.agentName}</span>
          <span className="text-[11px] text-text-muted">
            回复 {event.replyTo}
          </span>
          <span className="text-[11px] text-text-muted tabular-nums ml-auto">{event.time}</span>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          「{event.content}」
        </p>
      </div>
    </div>
  );
}

/* ── Main dispatcher ── */

export function FeedItem({ event }: { event: FeedEvent }) {
  const card = (() => {
    switch (event.kind) {
      case "game_end_summary":
        return <GameEndCard event={event} />;
      case "agent_reflection":
        return <ReflectionCard event={event} />;
      case "agent_impression":
        return <ImpressionCard event={event} />;
      case "agent_reply":
        return <ReplyCard event={event} />;
      default:
        return <SimpleItem event={event} />;
    }
  })();

  return (
    <>
      {card}
      {event.replies?.map((reply) => (
        <ReplyCard key={reply.id} event={reply} />
      ))}
    </>
  );
}
