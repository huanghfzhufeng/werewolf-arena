"use client";
import { WOBBLY_MD } from "@/app/design";

const ILLUSTRATIONS: Record<string, React.ReactNode> = {
  waiting: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto">
      <circle cx="40" cy="40" r="30" stroke="#e5e0d8" strokeWidth="3" strokeDasharray="6 4" />
      <path d="M30 38 Q40 28, 50 38" stroke="#d4c9b8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="32" r="2.5" fill="#d4c9b8" />
      <circle cx="48" cy="32" r="2.5" fill="#d4c9b8" />
      <path d="M25 52 Q32 48, 40 52 Q48 56, 55 52" stroke="#e5e0d8" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  ),
  games: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto">
      <rect x="15" y="20" width="50" height="40" rx="4" stroke="#e5e0d8" strokeWidth="3" strokeDasharray="6 4" />
      <path d="M25 35 L35 45 L55 30" stroke="#d4c9b8" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="60" cy="22" r="8" fill="#fff9c4" stroke="#e6a817" strokeWidth="2" />
      <text x="60" y="26" textAnchor="middle" fontSize="10" fill="#e6a817">🌙</text>
    </svg>
  ),
  feed: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto">
      <path d="M20 25 H60" stroke="#e5e0d8" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3" />
      <path d="M20 40 H55" stroke="#e5e0d8" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3" />
      <path d="M20 55 H50" stroke="#e5e0d8" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3" />
      <circle cx="14" cy="25" r="2" fill="#d4c9b8" />
      <circle cx="14" cy="40" r="2" fill="#d4c9b8" />
      <circle cx="14" cy="55" r="2" fill="#d4c9b8" />
    </svg>
  ),
};

export function EmptyState({
  illustration = "waiting",
  title,
  subtitle,
}: {
  illustration?: keyof typeof ILLUSTRATIONS;
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      className="text-center py-10 bg-white border-2 border-dashed border-ink/30"
      style={{ borderRadius: WOBBLY_MD }}
    >
      <div className="mb-3">{ILLUSTRATIONS[illustration] ?? ILLUSTRATIONS.waiting}</div>
      <div className="text-sm font-medium text-foreground/50">{title}</div>
      {subtitle && (
        <div className="text-xs text-foreground/35 mt-1">{subtitle}</div>
      )}
    </div>
  );
}
