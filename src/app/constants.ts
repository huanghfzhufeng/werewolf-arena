/**
 * Shared UI constants — labels, mappings, and config used across pages.
 * Single source of truth: do NOT duplicate these in page files.
 */

export const ROLE_LABELS: Record<string, string> = {
  werewolf: "🐺 狼人",
  wolf_king: "👑 狼王",
  white_wolf: "🐺 白狼王",
  seer: "🔮 预言家",
  witch: "🧪 女巫",
  guard: "🛡️ 守卫",
  hunter: "🔫 猎人",
  elder: "👴 长老",
  villager: "👤 村民",
  madman: "🃏 狂人",
  cupid: "💘 丘比特",
};

export const MODE_LABELS: Record<string, string> = {
  "classic-6p": "经典6人",
  "standard-8p": "标准8人",
  "advanced-12p": "进阶12人",
  "couples-9p": "情侣9人",
  "chaos-10p": "乱斗10人",
};

export const MODE_EMOJI: Record<string, string> = {
  "classic-6p": "⚔️",
  "standard-8p": "🏰",
  "advanced-12p": "👑",
  "couples-9p": "💕",
  "chaos-10p": "🌪️",
};

export const PHASE_LABELS: Record<string, string> = {
  lobby: "🏠 等待开始",
  night_werewolf: "🌙 狼人行动",
  night_seer: "🔮 预言家查验",
  night_witch: "🧪 女巫行动",
  night_guard: "🛡️ 守卫守护",
  night_cupid: "💘 丘比特连线",
  day_announce: "☀️ 天亮公告",
  day_discuss: "💬 白天讨论",
  day_vote: "🗳️ 投票环节",
  check_win: "⚖️ 胜负判定",
  game_over: "🎮 游戏结束",
};

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg?: string }
> = {
  idle: { label: "空闲", color: "#999", bg: "#f0f0f0" },
  browsing: { label: "浏览中", color: "#2d5da1", bg: "#e8eef6" },
  queued: { label: "排队中", color: "#e6a817", bg: "#fff9c4" },
  playing: { label: "对局中", color: "#2ecc71", bg: "#e6f9ed" },
  cooldown: { label: "休息中", color: "#9b59b6", bg: "#f3e8f9" },
  dormant: { label: "休眠", color: "#bbb", bg: "#f5f5f5" },
};

export const SORT_OPTIONS = [
  { value: "elo", label: "ELO" },
  { value: "winrate", label: "胜率" },
  { value: "games", label: "场次" },
  { value: "wins", label: "胜场" },
  { value: "newest", label: "最新" },
] as const;
