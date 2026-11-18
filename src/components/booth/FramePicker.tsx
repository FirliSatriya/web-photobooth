"use client";

import { Check, Lock } from "lucide-react";
import { FrameCanvas } from "@/components/FrameCanvas";
import { FRAMES, FILTERS, filterAvailable } from "@/lib/frames";
import { LAYOUTS, type FilterId, type LayoutType, type Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface FramePickerProps {
  tier: Tier;
  layout: LayoutType;
  frameId: string;
  filter: FilterId;
  participantCount: number;
  onLayout: (layout: LayoutType) => void;
  onFrame: (frameId: string) => void;
  onFilter: (filter: FilterId) => void;
  onUnlock: () => void;
}

export function FramePicker({
  tier,
  layout,
  frameId,
  filter,
  participantCount,
  onLayout,
  onFrame,
  onFilter,
  onUnlock,
}: FramePickerProps) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Tata letak</h3>
        <div className="grid grid-cols-3 gap-2">
          {LAYOUTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onLayout(item.id)}
              aria-pressed={layout === item.id}
              className={cn(
                "rounded-2xl border px-2 py-3 text-center transition",
                layout === item.id
                  ? "border-flame/60 bg-flame/10 text-white"
                  : "border-white/10 bg-black/20 text-white/55 hover:border-white/25",
              )}
            >
              <LayoutGlyph layout={item.id} />
              <span className="mt-2 block text-[11px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-white/35">
          {LAYOUTS.find((item) => item.id === layout)?.hint} · {LAYOUTS.find((item) => item.id === layout)?.shots} jepretan
        </p>
      </section>

      <section>
        <h3 className="mb-2.5 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          Bingkai
          <span className="font-normal normal-case tracking-normal text-white/30">
            {FRAMES.filter((frame) => frame.layout === layout).length} untuk layout ini
          </span>
        </h3>
        <div className="grid max-h-[326px] grid-cols-3 gap-2 overflow-y-auto pr-1">
          {FRAMES.map((frame) => {
            const locked = frame.isPremium && tier === "free";
            const active = frame.id === frameId;
            const wrongLayout = frame.layout !== layout;
            return (
              <button
                key={frame.id}
                type="button"
                onClick={() => (locked ? onUnlock() : onFrame(frame.id))}
                aria-pressed={active}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border text-left transition",
                  active ? "border-flame/70 bg-white/5" : "border-white/10 bg-black/20 hover:border-white/25",
                  wrongLayout && "opacity-45",
                )}
              >
                <div className="relative aspect-[3/4] w-full bg-[#141210] p-1.5">
                  <FrameCanvas frame={frame} participantCount={participantCount} longEdge={300} />
                  {locked ? (
                    <span className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-[#f6d9a8]">
                      <Lock className="h-2.5 w-2.5" />
                    </span>
                  ) : null}
                  {active ? (
                    <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-flame text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                </div>
                <span className="block truncate px-2 py-1.5 text-[10px] text-white/60">{frame.name}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-white/30">
          Bingkai yang diredupkan milik layout lain — pilih tata letaknya dulu.
        </p>
      </section>

      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Filter</h3>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const locked = !filterAvailable(item.id, tier);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => (locked ? onUnlock() : onFilter(item.id))}
                aria-pressed={filter === item.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
                  filter === item.id
                    ? "border-flame/60 bg-flame/15 text-white"
                    : "border-white/12 bg-black/20 text-white/55 hover:border-white/30",
                )}
              >
                <span className={cn("h-3 w-3 rounded-full border border-white/25", filterSwatch(item.id))} />
                {item.name}
                {locked ? <Lock className="h-2.5 w-2.5 text-[#f6d9a8]" /> : null}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function filterSwatch(id: FilterId): string {
  switch (id) {
    case "mono":
      return "bg-white/80";
    case "vintage":
      return "bg-[#d8b184]";
    case "cinematic":
      return "bg-[#2f5bff]";
    case "dreamy":
      return "bg-[#f0b7d8]";
    case "grain":
      return "bg-[#8d8d8d]";
    default:
      return "bg-transparent";
  }
}

function LayoutGlyph({ layout }: { layout: LayoutType }) {
  const cell = "rounded-[2px] bg-current";
  if (layout === "2x2_grid") {
    return (
      <span className="mx-auto grid h-8 w-8 grid-cols-2 grid-rows-2 gap-0.5 opacity-80">
        <i className={cell} />
        <i className={cell} />
        <i className={cell} />
        <i className={cell} />
      </span>
    );
  }
  if (layout === "1x2_wide") {
    return (
      <span className="mx-auto grid h-8 w-8 grid-rows-2 gap-0.5 opacity-80">
        <i className={cell} />
        <i className={cell} />
      </span>
    );
  }
  return (
    <span className="mx-auto grid h-8 w-8 grid-rows-4 gap-0.5 opacity-80">
      <i className={cell} />
      <i className={cell} />
      <i className={cell} />
      <i className={cell} />
    </span>
  );
}
