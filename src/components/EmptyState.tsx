"use client";

const ILLUSTRATIONS: Record<string, React.ReactNode> = {
  waiting: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto">
      <circle cx="32" cy="32" r="24" stroke="var(--border)" strokeWidth="2" strokeDasharray="6 4" />
      <path d="M24 30 Q32 22, 40 30" stroke="var(--text-muted)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="26" cy="26" r="2" fill="var(--text-muted)" />
      <circle cx="38" cy="26" r="2" fill="var(--text-muted)" />
    </svg>
  ),
  games: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto">
      <rect x="12" y="16" width="40" height="32" rx="6" stroke="var(--border)" strokeWidth="2" strokeDasharray="6 4" />
      <path d="M22 30 L28 36 L42 24" stroke="var(--text-muted)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  feed: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto">
      <path d="M16 22 H48" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
      <path d="M16 32 H44" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
      <path d="M16 42 H40" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
      <circle cx="12" cy="22" r="2" fill="var(--text-muted)" />
      <circle cx="12" cy="32" r="2" fill="var(--text-muted)" />
      <circle cx="12" cy="42" r="2" fill="var(--text-muted)" />
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
    <div className="text-center py-10 card border-dashed">
      <div className="mb-3">{ILLUSTRATIONS[illustration] ?? ILLUSTRATIONS.waiting}</div>
      <div className="text-sm font-medium text-text-secondary">{title}</div>
      {subtitle && (
        <div className="text-xs text-text-muted mt-1">{subtitle}</div>
      )}
    </div>
  );
}
