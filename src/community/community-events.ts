export type CommunityEventType =
  | "agent_status_change"
  | "lobby_update"
  | "game_auto_start"
  | "game_end_summary"
  | "agent_reflection"
  | "agent_impression";

export type CommunityEvent = {
  type: CommunityEventType;
  data: Record<string, unknown>;
  timestamp?: string;
};

// Global SSE subscriber registry for community events
type Subscriber = (event: CommunityEvent) => void;
const subscribers = new Set<Subscriber>();

// Ring buffer of recent events for initial feed population
const MAX_RECENT = 20;
const recentEvents: CommunityEvent[] = [];

export function getRecentCommunityEvents(): CommunityEvent[] {
  return [...recentEvents];
}

export function subscribeCommunity(callback: Subscriber): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function emitCommunity(event: CommunityEvent) {
  const withTimestamp = { ...event, timestamp: event.timestamp ?? new Date().toISOString() };
  recentEvents.unshift(withTimestamp);
  if (recentEvents.length > MAX_RECENT) recentEvents.length = MAX_RECENT;
  for (const cb of subscribers) {
    cb(withTimestamp);
  }
}
