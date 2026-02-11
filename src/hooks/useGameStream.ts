"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { GameEvent } from "@/engine/events";

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;

export function useGameStream(
  gameId: string | null,
  onEvent: (event: GameEvent) => void
) {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const retryDelayRef = useRef(INITIAL_RETRY_MS);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (!gameId) return;

    const eventSource = new EventSource(`/api/stream/${gameId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setReconnecting(false);
      retryDelayRef.current = INITIAL_RETRY_MS;
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
      eventSourceRef.current = null;

      // Schedule reconnect with exponential backoff
      setReconnecting(true);
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_MS);
      retryTimerRef.current = setTimeout(connect, delay);
    };

    const eventTypes = [
      "phase_change",
      "message",
      "vote",
      "death",
      "role_reveal",
      "seer_result",
      "game_over",
      "game_start",
      "thinking",
      "vote_tally",
      "night_fall",
      "day_break",
      "last_words",
      "witch_action",
      "hunter_shoot",
      "wolf_king_revenge",
    ];

    for (const type of eventTypes) {
      eventSource.addEventListener(type, (e) => {
        try {
          const event = JSON.parse(e.data) as GameEvent;
          onEventRef.current(event);
        } catch {
          // ignore parse errors
        }
      });
    }
  }, [gameId]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      setConnected(false);
      setReconnecting(false);
    };
  }, [connect]);

  return { connected, reconnecting };
}
