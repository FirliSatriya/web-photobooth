"use client";

import { useEffect, useRef } from "react";
import type { FrameSpec } from "@/lib/frames";
import { renderPlaceholderStrip } from "@/lib/preview";
import { cn } from "@/lib/utils";

export function FrameCanvas({
  frame,
  participantCount = 2,
  longEdge = 760,
  className,
}: {
  frame: FrameSpec;
  participantCount?: number;
  longEdge?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    renderPlaceholderStrip(ref.current, frame, { participantCount, longEdge });
  }, [frame, participantCount, longEdge]);

  return (
    <canvas
      ref={ref}
      className={cn("h-full w-full object-contain", className)}
      aria-label={`Pratinjau frame ${frame.name}`}
    />
  );
}
