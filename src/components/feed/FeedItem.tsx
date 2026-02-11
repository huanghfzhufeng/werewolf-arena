"use client";

export type FeedEvent = {
  id: string;
  text: string;
  time: string;
};

export function FeedItem({ event }: { event: FeedEvent }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-surface/50 hover:bg-surface-hover transition-colors animate-fade-in">
      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-text-muted flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-secondary">{event.text}</div>
        <div className="text-xs text-text-muted mt-0.5">{event.time}</div>
      </div>
    </div>
  );
}
