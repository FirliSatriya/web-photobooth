"use client";

import { useEffect, useRef } from "react";
import type { FrameSpec } from "@/lib/frames";
import { buildStageLayers, StageRenderer, type CellFeed, type StageLayers } from "@/lib/stage";
import type { LayoutType, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface StageSource {
  id: string;
  stream: MediaStream | null;
  mirrored: boolean;
}

export interface StagePreviewProps {
  sources: StageSource[];
  frame: FrameSpec;
  layout: LayoutType;
  participantCount: number;
  tier: Tier;
  watermark: boolean;
  roomCode: string;
  dateStamp: string;
  /** Local feed: either the raw camera or the AI backdrop canvas. */
  selfFeed: () => CellFeed | null;
  onCanvas?: (canvas: HTMLCanvasElement | null) => void;
  className?: string;
}

const PREVIEW_LONG_EDGE = 1000;

/**
 * Live compositing surface. The paper + ornaments are painted once per
 * frame/layout change (`buildStageLayers`), then every animation frame only
 * blits the video cells, so posing stays at 60 fps on laptops and phones.
 *
 * The same geometry drives the export, which is why the preview is a faithful
 * preview instead of an approximation.
 */
export function StagePreview({
  sources,
  frame,
  layout,
  participantCount,
  tier,
  watermark,
  roomCode,
  dateStamp,
  selfFeed,
  onCanvas,
  className,
}: StagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StageRenderer | null>(null);
  const layersRef = useRef<StageLayers | null>(null);
  const videosRef = useRef(new Map<string, HTMLVideoElement>());
  const sourcesRef = useRef(sources);
  const selfFeedRef = useRef(selfFeed);
  sourcesRef.current = sources;
  selfFeedRef.current = selfFeed;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const layers = buildStageLayers({
      frame,
      layout,
      participantCount: Math.max(1, participantCount),
      tier,
      watermark,
      roomCode,
      dateStamp,
      longEdge: PREVIEW_LONG_EDGE,
    });
    layersRef.current = layers;
    if (rendererRef.current) rendererRef.current.updateLayers(layers);
    else rendererRef.current = new StageRenderer(canvas, layers);
    onCanvas?.(canvas);
    return () => onCanvas?.(null);
  }, [frame, layout, participantCount, tier, watermark, roomCode, dateStamp, onCanvas]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const renderer = rendererRef.current;
      if (renderer) {
        const feeds: Array<CellFeed | null> = sourcesRef.current.map((source) => {
          if (source.id === "self") {
            const own = selfFeedRef.current();
            if (own) return own;
          }
          const element = videosRef.current.get(source.id);
          if (element && element.videoWidth > 0) {
            return {
              image: element,
              width: element.videoWidth,
              height: element.videoHeight,
              mirrored: source.mirrored,
            };
          }
          return null;
        });
        // Indexes must stay aligned with the participant slots, so nulls are
        // kept (the renderer paints a placeholder for them).
        renderer.draw(feeds as Array<CellFeed>);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // keep hidden <video> elements alive when a participant drops and rejoins
  useEffect(() => {
    for (const element of videosRef.current.values()) {
      if (element.paused) void element.play().catch(() => undefined);
    }
  }, [sources]);

  return (
    <div className={cn("relative", className)}>
      <canvas
        ref={canvasRef}
        className="mx-auto block h-auto w-auto max-h-[74vh] max-w-full object-contain drop-shadow-[0_30px_60px_color-mix(in_oklab,var(--brand-strong)_28%,transparent)]"
        role="img"
        aria-label="Pratinjau komposisi photostrip"
      />
      <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" aria-hidden>
        {sources.map((source) =>
          source.id === "self" ? null : (
            <video
              key={source.id}
              ref={(element) => {
                if (element) {
                  if (element.srcObject !== source.stream) element.srcObject = source.stream;
                  videosRef.current.set(source.id, element);
                  void element.play().catch(() => undefined);
                } else {
                  videosRef.current.delete(source.id);
                }
              }}
              autoPlay
              playsInline
              muted
            />
          ),
        )}
      </div>
    </div>
  );
}
