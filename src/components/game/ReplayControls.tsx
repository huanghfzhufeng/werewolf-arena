"use client";
import { Play, Pause, RotateCcw, X } from "lucide-react";
import type { ReplaySpeed } from "@/hooks/useReplay";

const SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 4];

export function ReplayControls({
  isPlaying,
  speed,
  progress,
  current,
  total,
  onToggle,
  onSetSpeed,
  onSeek,
  onReset,
  onExit,
}: {
  isPlaying: boolean;
  speed: ReplaySpeed;
  progress: number;
  current: number;
  total: number;
  onToggle: () => void;
  onSetSpeed: (s: ReplaySpeed) => void;
  onSeek: (fraction: number) => void;
  onReset: () => void;
  onExit: () => void;
}) {
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(fraction);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap">
        {/* Play / Pause */}
        <button
          onClick={onToggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-villager text-white hover:opacity-80 transition-opacity"
          title={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:border-text-secondary transition-colors"
          title="重头开始"
        >
          <RotateCcw size={14} />
        </button>

        {/* Speed selector */}
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSetSpeed(s)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                speed === s
                  ? "bg-villager text-white border-villager"
                  : "border-border text-text-muted hover:border-text-secondary"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Progress bar */}
        <div
          className="flex-1 min-w-[120px] cursor-pointer"
          onClick={handleProgressClick}
        >
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${progress * 100}%`,
                background: "var(--villager)",
              }}
            />
          </div>
        </div>

        {/* Counter */}
        <span className="text-xs text-text-muted whitespace-nowrap tabular-nums">
          {current}/{total}
        </span>

        {/* Exit replay */}
        <button
          onClick={onExit}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:border-wolf hover:text-wolf transition-colors ml-auto"
          title="退出回放"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
