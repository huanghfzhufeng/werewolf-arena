"use client";
import { Gamepad2, Users, Swords, Clock, Moon } from "lucide-react";
import { WOBBLY_SM, hardShadowSm } from "@/app/design";

export function StatsBar({
  agentCount,
  playing,
  queued,
  idle,
  activeGames,
}: {
  agentCount: number;
  playing: number;
  queued: number;
  idle: number;
  activeGames: number;
}) {
  const stats = [
    { icon: <Users size={18} strokeWidth={2.5} />, value: agentCount, label: "社区 Agent", rotation: "-1deg" },
    { icon: <Swords size={18} strokeWidth={2.5} />, value: playing, label: "对局中", rotation: "1deg", color: "#2ecc71" },
    { icon: <Clock size={18} strokeWidth={2.5} />, value: queued, label: "排队中", rotation: "-0.5deg", color: "#e6a817" },
    { icon: <Moon size={18} strokeWidth={2.5} />, value: idle, label: "空闲", rotation: "0.8deg" },
    { icon: <Gamepad2 size={18} strokeWidth={2.5} />, value: activeGames, label: "进行中对局", rotation: "-1.2deg", color: "#2d5da1" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white border-2 border-ink p-4 text-center transition-transform duration-100 hover:scale-105"
          style={{
            borderRadius: WOBBLY_SM,
            transform: `rotate(${stat.rotation})`,
            ...hardShadowSm,
          }}
        >
          <div className="flex items-center justify-center gap-1 mb-1 text-foreground/50">
            {stat.icon}
          </div>
          <div
            className="text-3xl font-[family-name:var(--font-kalam)] font-bold"
            style={{ color: stat.color ?? "#2d2d2d" }}
          >
            {stat.value}
          </div>
          <div className="text-xs text-foreground/50">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
