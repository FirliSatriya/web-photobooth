"use client";

import { useCallback, useEffect, useRef } from "react";
import type { FrameSpec } from "@/lib/frames";
import type { FilterId, LayoutType, Tier } from "@/lib/types";
import type { WorkerRequest, WorkerResponse } from "@/lib/workers/media.worker";

export interface ComposeRequest {
  layout: LayoutType;
  tier: Tier;
  frame: FrameSpec;
  filter: FilterId;
  participantIds: string[];
  participantLabels: Record<string, string>;
  shots: Array<Record<string, { blob: Blob; width: number; height: number }>>;
  watermark: boolean;
  roomCode: string;
  dateStamp: string;
  longEdge: number;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

/**
 * Single long-lived worker for both photo compositing and MP4 encoding. The
 * heavy lifting (OffscreenCanvas + WebGL + WebCodecs) never touches the UI
 * thread, so the countdown never stutters.
 */
export function useMediaWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<string, Pending>());

  useEffect(() => {
    const worker = new Worker(new URL("../lib/workers/media.worker.ts", import.meta.url), {
      type: "module",
      name: "photobooth-media",
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const entry = pending.current.get(response.id);
      if (!entry) return;
      pending.current.delete(response.id);
      if (response.kind === "error") entry.reject(new Error(response.message));
      else if (response.kind === "compose") entry.resolve(response.blob);
      else entry.resolve(new Blob([response.buffer], { type: response.mime }));
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || "Media worker error");
      for (const [, entry] of pending.current) entry.reject(error);
      pending.current.clear();
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
      pending.current.clear();
    };
  }, []);

  const request = useCallback((payload: WorkerRequest, transfer: Transferable[]) => {
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error("Media worker belum siap"));
    return new Promise<unknown>((resolve, reject) => {
      pending.current.set(payload.id, { resolve, reject });
      worker.postMessage(payload, transfer);
    });
  }, []);

  const compose = useCallback(
    async (params: ComposeRequest): Promise<Blob> => {
      type WorkerShots = Array<Record<string, { bitmap: ImageBitmap }>>;
      const shots: WorkerShots = [];
      const transfer: Transferable[] = [];

      for (const shot of params.shots) {
        const record: Record<string, { bitmap: ImageBitmap }> = {};
        for (const [participantId, value] of Object.entries(shot)) {
          const bitmap = await createImageBitmap(value.blob);
          record[participantId] = { bitmap };
          transfer.push(bitmap);
        }
        shots.push(record);
      }

      const id = `compose-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const payload = {
        id,
        kind: "compose",
        input: {
          layout: params.layout,
          tier: params.tier,
          frame: params.frame,
          filter: params.filter,
          participantIds: params.participantIds,
          participantLabels: params.participantLabels,
          watermark: params.watermark,
          roomCode: params.roomCode,
          dateStamp: params.dateStamp,
          longEdge: params.longEdge,
          shots,
        },
      } as unknown as WorkerRequest;
      const result = await request(payload, transfer);
      return result as Blob;
    },
    [request],
  );

  const encodeVideo = useCallback(
    async (frames: ImageBitmap[], fps: number, pingPong = false): Promise<Blob> => {
      if (frames.length === 0) throw new Error("Tidak ada frame untuk boomerang");
      const width = frames[0].width;
      const height = frames[0].height;
      const id = `encode-${Date.now()}`;
      const result = await request(
        { id, kind: "encode", width, height, frames, fps, pingPong },
        frames as unknown as Transferable[],
      );
      return result as Blob;
    },
    [request],
  );

  return { compose, encodeVideo };
}
