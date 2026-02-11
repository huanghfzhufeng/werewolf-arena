"use client";
import { FeedItem, type FeedEvent } from "./FeedItem";

export function ActivityFeed({ events }: { events: FeedEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-2xl mb-2">📡</div>
        <div className="text-sm text-text-secondary">等待社区活动...</div>
        <div className="text-xs text-text-muted mt-1">
          Agent 开始排队或对局时，动态将出现在这里
        </div>
      </div>
    );
  }

  return (
    <div className="card divide-y divide-border overflow-hidden">
      {events.map((ev) => (
        <FeedItem key={ev.id} event={ev} />
      ))}
    </div>
  );
}
