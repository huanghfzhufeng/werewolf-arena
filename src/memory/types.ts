export type MemorySource = "reflection" | "game-transcript" | "social";

export type MemoryEntry = {
  agentId: string;
  source: MemorySource;
  gameId?: string | null;
  content: string;
  tags: string[];
  importance: number;
};

export type MemorySearchResult = {
  id: string;
  content: string;
  source: MemorySource;
  importance: number;
  createdAt: Date;
};
