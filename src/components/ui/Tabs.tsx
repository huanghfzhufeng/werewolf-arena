"use client";
import { useState } from "react";

type Tab = {
  key: string;
  label: string;
  icon?: React.ReactNode;
};

export function Tabs({
  tabs,
  defaultTab,
  children,
}: {
  tabs: Tab[];
  defaultTab?: string;
  children: (activeTab: string) => React.ReactNode;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key ?? "");

  return (
    <div>
      <div className="flex border-b border-border mb-4 gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative"
            style={{
              color:
                active === tab.key
                  ? "var(--text-primary)"
                  : "var(--text-muted)",
            }}
          >
            {tab.icon}
            {tab.label}
            {active === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-villager rounded-full" />
            )}
          </button>
        ))}
      </div>
      <div className="animate-fade-in">{children(active)}</div>
    </div>
  );
}
