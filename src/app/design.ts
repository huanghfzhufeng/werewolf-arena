/**
 * Hand-Drawn Design System — Centralized Design Tokens
 *
 * Wobbly border-radius values that create irregular, organic edges.
 * These CANNOT be expressed as Tailwind classes and must be applied via inline style.
 */

export const WOBBLY = "255px 15px 225px 15px / 15px 225px 15px 255px";
export const WOBBLY_MD = "15px 225px 15px 255px / 255px 15px 225px 15px";
export const WOBBLY_SM = "125px 10px 115px 10px / 10px 115px 10px 125px";
export const WOBBLY_PILL = "225px 55px 225px 55px / 55px 225px 55px 225px";

export const COLORS = {
  bg: "#fdfbf7",
  fg: "#2d2d2d",
  muted: "#e5e0d8",
  accent: "#ff4d4d",
  border: "#2d2d2d",
  blue: "#2d5da1",
  postit: "#fff9c4",
  white: "#ffffff",
} as const;

export const hardShadow = {
  boxShadow: `4px 4px 0px 0px ${COLORS.border}`,
} as const;

export const hardShadowSm = {
  boxShadow: `3px 3px 0px 0px rgba(45, 45, 45, 0.15)`,
} as const;

export const hardShadowHover = {
  boxShadow: `2px 2px 0px 0px ${COLORS.border}`,
} as const;

export const hardShadowLg = {
  boxShadow: `8px 8px 0px 0px ${COLORS.border}`,
} as const;

export const noShadow = {
  boxShadow: "none",
} as const;
