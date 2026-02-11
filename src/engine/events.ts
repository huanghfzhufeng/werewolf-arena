export type GameEventType =
  | "phase_change"
  | "message"
  | "vote"
  | "death"
  | "role_reveal"
  | "seer_result"
  | "dreamweaver_result"
  | "game_over"
  | "game_start"
  | "thinking"
  | "vote_tally"
  | "last_words"
  | "night_fall"
  | "day_break"
  | "witch_action"
  | "hunter_shoot"
  | "wolf_king_revenge"
  | "knight_check"
  | "idiot_reveal"
  | "enchant_action";

export type GameEvent = {
  type: GameEventType;
  gameId: string;
  round: number;
  timestamp: string;
  data: Record<string, unknown>;
};

// Global SSE subscriber registry (in-memory for MVP)
type Subscriber = (event: GameEvent) => void;
const subscribers = new Map<string, Set<Subscriber>>();

export function subscribe(gameId: string, callback: Subscriber): () => void {
  if (!subscribers.has(gameId)) {
    subscribers.set(gameId, new Set());
  }
  subscribers.get(gameId)!.add(callback);
  return () => {
    subscribers.get(gameId)?.delete(callback);
    if (subscribers.get(gameId)?.size === 0) {
      subscribers.delete(gameId);
    }
  };
}

export function emit(event: GameEvent) {
  const subs = subscribers.get(event.gameId);
  if (subs) {
    for (const cb of subs) {
      cb(event);
    }
  }
}
