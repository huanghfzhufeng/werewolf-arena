import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  pgEnum,
  real,
  jsonb,
  customType,
} from "drizzle-orm/pg-core";

/** pgvector vector column type */
const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; dpiverType: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]) {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: unknown) {
      return (value as string)
        .slice(1, -1)
        .split(",")
        .map(Number);
    },
  })(name);

/** Shape stored in agents.personality / players.personality jsonb columns */
export type PersonalityData = {
  character: string;
  series: string;
  avatar: string;
  trait: string;
  speakingStyle: string;
  catchphrase: string;
};

export const gameStatusEnum = pgEnum("game_status", [
  "lobby",
  "playing",
  "finished",
]);

// Note: 'browsing' is currently unused. Keep it reserved for future use.
export const agentStatusEnum = pgEnum("agent_status", [
  "idle",
  /* @reserved */ "browsing",
  "queued",
  "playing",
  "cooldown",
  "dormant",
]);

export const playModeEnum = pgEnum("play_mode", ["hosted", "autonomous"]);

export const lobbyStatusEnum = pgEnum("lobby_status", [
  "waiting",
  "starting",
  "playing",
  "finished",
]);

export const phaseEnum = pgEnum("phase", [
  "lobby",
  "night_cupid",
  "night_werewolf",
  "night_seer",
  "night_witch",
  "night_guard",
  "day_announce",
  "day_discuss",
  "day_vote",
  "check_win",
  "game_over",
]);

export const roleEnum = pgEnum("role", [
  "werewolf",
  "wolf_king",
  "white_wolf",
  "seer",
  "witch",
  "guard",
  "hunter",
  "elder",
  "cupid",
  "madman",
  "villager",
]);

export const winnerEnum = pgEnum("winner", ["werewolf", "villager", "draw"]);

export const actionTypeEnum = pgEnum("action_type", [
  "seer_check",
  "werewolf_kill",
  "witch_save",
  "witch_poison",
  "guard_protect",
  "hunter_shoot",
  "cupid_link",
  "white_wolf_explode",
  // Added for correctness
  "wolf_king_revenge",
  // Track elder's passive extra life usage to survive reloads
  "elder_extra_life",
]);

// ─── Owner Table ────────────────────────────────────────────────

export const agentOwners = pgTable("agent_owners", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  email: text("email").unique(),
  apiKey: text("api_key").notNull().unique(),
  maxAgents: integer("max_agents").notNull().default(5),
  githubId: text("github_id").unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Community Tables ───────────────────────────────────────────

export const agents = pgTable("agents", {
  // Indexes: status (lifecycle tick), ownerId (owner agent list)
  // Applied via: CREATE INDEX idx_agents_status ON agents(status);
  //              CREATE INDEX idx_agents_owner ON agents(owner_id);
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  personality: jsonb("personality").notNull().$type<PersonalityData>(),
  avatar: text("avatar").notNull().default("🎭"),
  status: agentStatusEnum("status").notNull().default("idle"),
  cooldownUntil: timestamp("cooldown_until"),
  totalGames: integer("total_games").notNull().default(0),
  totalWins: integer("total_wins").notNull().default(0),
  winRate: real("win_rate").notNull().default(0),
  lastGameId: uuid("last_game_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // ── Moltbook-style fields ──
  apiKey: text("api_key").unique(),
  ownerId: uuid("owner_id").references(() => agentOwners.id),
  isSystem: boolean("is_system").notNull().default(false),
  bio: text("bio").notNull().default(""),
  avatarUrl: text("avatar_url"),
  elo: integer("elo").notNull().default(1000),
  tags: text("tags").array().notNull().default([]),
  webhookUrl: text("webhook_url"),
  activeUntil: timestamp("active_until"),
  playMode: playModeEnum("play_mode").notNull().default("hosted"),
  claimToken: text("claim_token").unique(),
});

export const lobbies = pgTable("lobbies", {
  id: uuid("id").primaryKey().defaultRandom(),
  modeId: text("mode_id").notNull(),
  status: lobbyStatusEnum("status").notNull().default("waiting"),
  requiredPlayers: integer("required_players").notNull(),
  gameId: uuid("game_id").references(() => games.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const lobbyMembers = pgTable("lobby_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  lobbyId: uuid("lobby_id")
    .notNull()
    .references(() => lobbies.id),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

// ─── Game Tables ────────────────────────────────────────────────

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  modeId: text("mode_id").notNull().default("classic-6p"),
  status: gameStatusEnum("status").notNull().default("lobby"),
  currentPhase: phaseEnum("current_phase").notNull().default("lobby"),
  currentRound: integer("current_round").notNull().default(0),
  winner: winnerEnum("winner"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
});

export const players = pgTable("players", {
  // Index: gameId (getAllPlayers), agentId (recent games lookup)
  // Applied via: CREATE INDEX idx_players_game ON players(game_id);
  //              CREATE INDEX idx_players_agent ON players(agent_id);
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id),
  agentId: uuid("agent_id").references(() => agents.id),
  agentName: text("agent_name").notNull(),
  role: roleEnum("role"),
  isAlive: boolean("is_alive").notNull().default(true),
  personality: jsonb("personality").notNull().$type<PersonalityData>(),
  seatNumber: integer("seat_number").notNull(),
});

export const messages = pgTable("messages", {
  // Index: (gameId, createdAt) for chat history queries
  // Applied via: CREATE INDEX idx_messages_game ON messages(game_id, created_at);
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id),
  round: integer("round").notNull(),
  phase: phaseEnum("phase").notNull(),
  playerId: uuid("player_id").references(() => players.id),
  content: text("content").notNull(),
  isPrivate: boolean("is_private").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const votes = pgTable("votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id),
  round: integer("round").notNull(),
  voterId: uuid("voter_id")
    .notNull()
    .references(() => players.id),
  targetId: uuid("target_id")
    .notNull()
    .references(() => players.id),
  phase: phaseEnum("phase").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const actions = pgTable("actions", {
  // Index: (gameId, actionType) for night resolution queries
  // Applied via: CREATE INDEX idx_actions_game_type ON actions(game_id, action_type);
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id),
  round: integer("round").notNull(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id),
  actionType: actionTypeEnum("action_type").notNull(),
  targetId: uuid("target_id")
    .notNull()
    .references(() => players.id),
  result: text("result"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Memory Tables ──────────────────────────────────────────────

export const memorySourceEnum = pgEnum("memory_source", [
  "reflection",
  "game-transcript",
  "social",
  "self-note",
]);

export const postTypeEnum = pgEnum("post_type", [
  "reflection",
  "impression",
  "reply",
]);

export const agentMemories = pgTable("agent_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id),
  source: memorySourceEnum("source").notNull(),
  gameId: uuid("game_id").references(() => games.id),
  content: text("content").notNull(),
  tags: text("tags").array().notNull().default([]),
  importance: real("importance").notNull().default(0.5),
  embedding: vector("embedding", 1536),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentPosts = pgTable("agent_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id),
  type: postTypeEnum("type").notNull(),
  parentId: uuid("parent_id"),
  gameId: uuid("game_id").references(() => games.id),
  targetAgentId: uuid("target_agent_id").references(() => agents.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Type exports
export type AgentOwner = typeof agentOwners.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Lobby = typeof lobbies.$inferSelect;
export type LobbyMember = typeof lobbyMembers.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type Action = typeof actions.$inferSelect;
export type AgentMemory = typeof agentMemories.$inferSelect;
export type AgentPost = typeof agentPosts.$inferSelect;
