export type PersonalityInfo = {
  character: string;
  series: string;
  avatar: string;
  catchphrase: string;
};

export type PlayerInfo = {
  id: string;
  agentName: string;
  seatNumber: number;
  isAlive: boolean;
  role?: string;
  personality?: string;
  parsedPersonality?: PersonalityInfo;
};

export type FeedItem = {
  id: string;
  kind:
    | "message"
    | "system"
    | "thinking"
    | "vote"
    | "vote_tally"
    | "atmosphere"
    | "last_words"
    | "seer_result";
  playerId?: string;
  content: string;
  isPrivate?: boolean;
  round: number;
  timestamp: string;
  extra?: Record<string, unknown>;
};

export type GameState = {
  id: string;
  status: string;
  currentPhase: string;
  currentRound: number;
  winner?: string;
  modeId?: string;
};

export function parsePersonality(raw?: string): PersonalityInfo | undefined {
  if (!raw) return undefined;
  try {
    const p = JSON.parse(raw);
    return {
      character: p.character ?? "",
      series: p.series ?? "",
      avatar: p.avatar ?? "🎭",
      catchphrase: p.catchphrase ?? "",
    };
  } catch {
    return undefined;
  }
}
