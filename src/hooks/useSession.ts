"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SessionState {
  enabled: boolean;
  remaining: number;
  canRetake: boolean;
  retakeCount: number;
  maxRetakes: number;
}

/**
 * Room level limits. The clock is derived from expiresAt so a page refresh
 * cannot extend a free session, and retake accounting stays on the server.
 */
export function useRoomLimits(expiresAt: string | null, retakesUsed: number, maxRetakes: number) {
  const [remaining, setRemaining] = useState(() =>
    expiresAt ? Math.max(0, Date.parse(expiresAt) - Date.now()) : 0,
  );

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setRemaining(Math.max(0, Date.parse(expiresAt) - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const unlimited = !Number.isFinite(maxRetakes) || maxRetakes >= 9999;

  return {
    remaining,
    expired: remaining <= 0,
    canRetake: retakesUsed < maxRetakes,
    retakeLabel: unlimited ? "∞" : `${retakesUsed}/${maxRetakes}`,
  };
}

export interface CountdownState {
  running: boolean;
  /** 3, 2, 1 then null when the shutter fires */
  value: number | null;
  shotIndex: number;
  isRetake: boolean;
}

export const IDLE_COUNTDOWN: CountdownState = {
  running: false,
  value: null,
  shotIndex: 0,
  isRetake: false,
};

export function useCountdown() {
  const [state, setState] = useState<CountdownState>(IDLE_COUNTDOWN);
  const timer = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    setState(IDLE_COUNTDOWN);
  }, []);

  const start = useCallback(
    (durationMs: number, onComplete: () => void, meta: { shotIndex: number; isRetake: boolean }) => {
      if (timer.current) window.clearInterval(timer.current);
      const startedAt = Date.now();
      setState({ running: true, value: Math.ceil(durationMs / 1000), shotIndex: meta.shotIndex, isRetake: meta.isRetake });

      timer.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const left = Math.ceil((durationMs - elapsed) / 1000);
        if (left <= 0) {
          if (timer.current) window.clearInterval(timer.current);
          timer.current = null;
          setState({ running: false, value: null, shotIndex: meta.shotIndex, isRetake: meta.isRetake });
          onComplete();
          return;
        }
        setState({
          running: true,
          value: left,
          shotIndex: meta.shotIndex,
          isRetake: meta.isRetake,
        });
      }, 100);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  return { ...state, start, cancel };
}
