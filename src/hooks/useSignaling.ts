"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createTransport, signalingMode, type SignalStatus, type SignalTransport } from "@/lib/signaling";
import type { SignalMessage } from "@/lib/types";

export function useSignaling(roomCode: string | null, selfId: string) {
  const transportRef = useRef<SignalTransport | null>(null);
  const handlersRef = useRef(new Set<(message: SignalMessage) => void>());
  const [status, setStatus] = useState<SignalStatus>("connecting");

  useEffect(() => {
    if (!roomCode) return;
    const transport = createTransport(
      roomCode,
      selfId,
      (message) => {
        for (const handler of handlersRef.current) handler(message);
      },
      setStatus,
    );
    transportRef.current = transport;
    setStatus(transport.kind === "broadcast-channel" ? "connected" : "connecting");

    const bye = () => {
      transport.send({ t: "bye", peerId: selfId });
    };
    window.addEventListener("beforeunload", bye);
    return () => {
      window.removeEventListener("beforeunload", bye);
      bye();
      transport.close();
      transportRef.current = null;
    };
  }, [roomCode, selfId]);

  const send = useCallback((message: SignalMessage) => {
    transportRef.current?.send(message);
  }, []);

  const subscribe = useCallback((handler: (message: SignalMessage) => void) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  return { send, subscribe, status, mode: signalingMode() };
}
