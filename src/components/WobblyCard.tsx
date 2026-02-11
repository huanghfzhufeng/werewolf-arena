"use client";
import type { CSSProperties, ReactNode } from "react";
import { WOBBLY, WOBBLY_MD, WOBBLY_SM, hardShadow, hardShadowSm } from "@/app/design";

type Size = "sm" | "md" | "lg";

const RADIUS: Record<Size, string> = {
  sm: WOBBLY_SM,
  md: WOBBLY_MD,
  lg: WOBBLY,
};

const SHADOW: Record<Size, { boxShadow: string }> = {
  sm: hardShadowSm,
  md: hardShadowSm,
  lg: hardShadow,
};

export function WobblyCard({
  children,
  size = "sm",
  className = "",
  style,
  rotate,
}: {
  children: ReactNode;
  size?: Size;
  className?: string;
  style?: CSSProperties;
  rotate?: string;
}) {
  return (
    <div
      className={`bg-white border-2 border-ink ${className}`}
      style={{
        borderRadius: RADIUS[size],
        ...SHADOW[size],
        ...(rotate ? { transform: `rotate(${rotate})` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
