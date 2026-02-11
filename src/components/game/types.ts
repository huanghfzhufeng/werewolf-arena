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
  personality?: PersonalityInfo | string | null;
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

export function parsePersonality(raw?: PersonalityInfo | Record<string, unknown> | string | null): PersonalityInfo | undefined {
  if (!raw) return undefined;
  // If it's already an object (jsonb column), extract fields directly
  const p = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  if (!p || typeof p !== "object") return undefined;
  return {
    character: (p as Record<string, unknown>).character as string ?? "",
    series: (p as Record<string, unknown>).series as string ?? "",
    avatar: (p as Record<string, unknown>).avatar as string ?? "🎭",
    catchphrase: (p as Record<string, unknown>).catchphrase as string ?? "",
  };
}
