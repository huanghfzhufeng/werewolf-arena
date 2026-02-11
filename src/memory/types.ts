export type MemorySource = "reflection" | "game-transcript" | "social" | "self-note";

export type MemoryEntry = {
  agentId: string;
  source: MemorySource;
  gameId?: string | null;
  content: string;
  tags: string[];
  importance: number;
  embedding?: number[] | null;
};

export type MemorySearchResult = {
  id: string;
  content: string;
  source: MemorySource;
  importance: number;
  createdAt: Date;
  score?: number;
};

/** Structured note returned by LLM when agent self-writes memory */
export type AgentMemoryNote = {
  content: string;
  tags: string[];
  importance: number;
  source: MemorySource;
};
