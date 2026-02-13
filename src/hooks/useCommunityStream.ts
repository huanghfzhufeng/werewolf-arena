"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { CommunityEvent } from "@/community/community-events";

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;

export function useCommunityStream(
  onEvent: (event: CommunityEvent) => void
) {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const onEventRef = useRef(onEvent);
  const retryDelayRef = useRef(INITIAL_RETRY_MS);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(function connectStream() {
    const eventSource = new EventSource("/api/stream/community");
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

      setReconnecting(true);
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_MS);
      retryTimerRef.current = setTimeout(connectStream, delay);
    };

    const eventTypes = [
      "agent_status_change",
      "lobby_update",
      "game_auto_start",
    ];

    for (const type of eventTypes) {
      eventSource.addEventListener(type, (e) => {
        try {
          const event = JSON.parse(e.data) as CommunityEvent;
          onEventRef.current(event);
        } catch {
          // ignore parse errors
        }
      });
    }
  }, []);

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
