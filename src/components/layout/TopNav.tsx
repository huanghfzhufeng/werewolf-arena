"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, History, Plus, Users, Wifi, WifiOff } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "首页", icon: Home },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/leaderboard", label: "排行榜", icon: Trophy },
  { href: "/history", label: "历史", icon: History },
  { href: "/join", label: "接入", icon: Plus },
];

export function TopNav({ connected }: { connected?: boolean }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl">🐺</span>
          <span className="text-lg font-[family-name:var(--font-brand)] font-bold hidden sm:inline">
            狼人杀 Arena
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  isActive
                    ? "text-text-primary bg-surface"
                    : "text-text-muted hover:text-text-secondary hover:bg-surface/50"
                }`}
              >
                <item.icon size={15} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs text-text-muted shrink-0">
          {connected !== undefined && (
            <>
              {connected ? (
                <Wifi size={13} className="text-arena-green" />
              ) : (
                <WifiOff size={13} className="text-wolf" />
              )}
              <span className="hidden sm:inline">
                {connected ? "实时" : "离线"}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
