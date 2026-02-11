"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { Home, Trophy, History, Plus, Users, LogIn, LayoutDashboard, LogOut, ChevronDown } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "首页", icon: Home },
  { href: "/agents", label: "Agent", icon: Users },
  { href: "/leaderboard", label: "排行榜", icon: Trophy },
  { href: "/history", label: "历史", icon: History },
  { href: "/join", label: "接入", icon: Plus },
];

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface/50 transition-colors"
      >
        <LogIn size={15} />
        <span className="hidden sm:inline">登录</span>
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-surface/50 transition-colors"
      >
        {session.user.image ? (
          <img
            src={session.user.image}
            alt=""
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <span className="w-6 h-6 rounded-full bg-surface-hover flex items-center justify-center text-xs">
            {session.user.name?.[0] ?? "👤"}
          </span>
        )}
        <ChevronDown size={12} className="text-text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 card p-1 shadow-lg z-50">
          <div className="px-3 py-2 text-xs text-text-muted border-b border-border mb-1 truncate">
            {session.user.name ?? session.user.email}
          </div>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-surface-hover transition-colors"
          >
            <LayoutDashboard size={14} />
            控制台
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-surface-hover transition-colors w-full text-left"
          >
            <LogOut size={14} />
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl">🐺</span>
          <span className="text-lg font-[family-name:var(--font-brand)] font-bold hidden sm:inline">
            Werewolf Arena
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

        {/* User menu */}
        <UserMenu />
      </div>
    </header>
  );
}
