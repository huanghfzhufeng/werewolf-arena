"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import type { FeedItem } from "@/components/game/types";

export type ReplaySpeed = 0.5 | 1 | 2 | 4;

export type ReplayState = {
  /** Currently visible feed items */
  visibleItems: FeedItem[];
  /** Whether replay is actively playing */
  isPlaying: boolean;
  /** Current playback speed multiplier */
  speed: ReplaySpeed;
  /** Progress 0–1 */
  progress: number;
  /** Current pointer index */
  current: number;
  /** Total items */
  total: number;
  /** True while loading replay data */
  loading: boolean;

  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (s: ReplaySpeed) => void;
  seekTo: (fraction: number) => void;
  reset: () => void;
};

const BASE_INTERVAL_MS = 1200; // time between items at 1x speed

export function useReplay(
  gameId: string,
  enabled: boolean
): ReplayState {
  const [timeline, setTimeline] = useState<FeedItem[]>([]);
  const [pointer, setPointer] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load replay data
  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => {
        setTimeline([]);
        setPointer(0);
        setIsPlaying(false);
      });
      return;
    }
    queueMicrotask(() => setLoading(true));
    fetch(`/api/games/${gameId}/replay`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.timeline) {
          setTimeline(data.timeline);
          setPointer(0);
          setIsPlaying(false);
        }
      })
      .catch(() => {})
      .finally(() => queueMicrotask(() => setLoading(false)));
  }, [gameId, enabled]);

  // Playback timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPlaying || timeline.length === 0) return;

    const interval = BASE_INTERVAL_MS / speed;
    timerRef.current = setInterval(() => {
      setPointer((prev) => {
        if (prev >= timeline.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, timeline.length]);

  // Auto-pause when reaching the end
  useEffect(() => {
    if (isPlaying && pointer >= timeline.length && timeline.length > 0) {
      queueMicrotask(() => setIsPlaying(false));
    }
  }, [isPlaying, pointer, timeline.length]);

  const play = useCallback(() => {
    if (pointer >= timeline.length) setPointer(0);
    setIsPlaying(true);
  }, [pointer, timeline.length]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seekTo = useCallback(
    (fraction: number) => {
      const idx = Math.round(fraction * timeline.length);
      setPointer(Math.max(0, Math.min(idx, timeline.length)));
    },
    [timeline.length]
  );

  const reset = useCallback(() => {
    setPointer(0);
    setIsPlaying(false);
  }, []);

  return {
    visibleItems: timeline.slice(0, pointer),
    isPlaying,
    speed,
    progress: timeline.length > 0 ? pointer / timeline.length : 0,
    current: pointer,
    total: timeline.length,
    loading,
    play,
    pause,
    toggle,
    setSpeed,
    seekTo,
    reset,
  };
}
