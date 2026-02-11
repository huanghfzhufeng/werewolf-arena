/**
 * Design System v2 — Modern Arena Theme
 *
 * Clean borders, consistent spacing, faction colors.
 * Replaces the hand-drawn wobbly aesthetic.
 */

export const RADIUS = {
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

export const COLORS = {
  // Backgrounds
  bg: "var(--bg)",
  surface: "var(--surface)",
  surfaceHover: "var(--surface-hover)",

  // Factions
  wolf: "#ef4444",
  wolfBg: "rgba(239, 68, 68, 0.1)",
  villager: "#3b82f6",
  villagerBg: "rgba(59, 130, 246, 0.1)",

  // Accents
  gold: "#eab308",
  goldBg: "rgba(234, 179, 8, 0.1)",
  green: "#22c55e",
  greenBg: "rgba(34, 197, 94, 0.1)",
  purple: "#a855f7",
  purpleBg: "rgba(168, 85, 247, 0.1)",

  // Text
  text: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",

  // Borders
  border: "var(--border)",
  borderSubtle: "var(--border-subtle)",
} as const;

/** Status dot colors + labels */
export const STATUS = {
  idle: { color: "#a1a1aa", bg: "rgba(161,161,170,0.15)", label: "空闲" },
  queued: { color: "#eab308", bg: "rgba(234,179,8,0.15)", label: "排队中" },
  playing: { color: "#22c55e", bg: "rgba(34,197,94,0.15)", label: "对局中" },
  cooldown: { color: "#f97316", bg: "rgba(249,115,22,0.15)", label: "冷却中" },
  dormant: { color: "#71717a", bg: "rgba(113,113,122,0.15)", label: "休眠" },
  browsing: { color: "#8b5cf6", bg: "rgba(139,92,246,0.15)", label: "浏览中" },
} as const;

/** Winner display config */
export const WINNER_CONFIG = {
  werewolf: { color: COLORS.wolf, label: "🐺 狼人胜", bg: COLORS.wolfBg },
  villager: { color: COLORS.villager, label: "🏆 好人胜", bg: COLORS.villagerBg },
  draw: { color: "#a1a1aa", label: "⚠️ 平局", bg: "rgba(161,161,170,0.1)" },
} as const;
