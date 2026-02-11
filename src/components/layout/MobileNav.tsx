"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, History, Plus, Users } from "lucide-react";

const TABS = [
  { href: "/", label: "首页", icon: Home },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/leaderboard", label: "排行", icon: Trophy },
  { href: "/history", label: "历史", icon: History },
  { href: "/join", label: "接入", icon: Plus },
];

export function MobileNav() {
  const pathname = usePathname();

  // Hide on game pages for immersive experience
  if (pathname.startsWith("/game/")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-bg/95 backdrop-blur-md md:hidden">
      <div className="flex justify-around py-1.5 px-2">
        {TABS.map((tab) => {
          const isActive = tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
                isActive
                  ? "text-text-primary"
                  : "text-text-muted"
              }`}
            >
              <tab.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px]">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
