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
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tata letak</h3>
        <div className="grid grid-cols-3 gap-2">
          {LAYOUTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onLayout(item.id)}
              aria-pressed={layout === item.id}
              className={cn(
                "min-h-[76px] rounded-2xl border px-2 py-3 text-center transition",
                layout === item.id
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border/70 bg-card/60 text-muted-foreground hover:border-primary/40 hover:bg-secondary hover:text-foreground",
              )}
            >
              <LayoutGlyph layout={item.id} />
              <span className="mt-2 block text-[11px] font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {LAYOUTS.find((item) => item.id === layout)?.hint} · {LAYOUTS.find((item) => item.id === layout)?.shots} jepretan
        </p>
      </section>

      <section>
        <h3 className="mb-2.5 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Bingkai
          <span className="font-normal normal-case tracking-normal text-muted-foreground/90">
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
                aria-label={`${frame.name}${locked ? " — terkunci, butuh Session Pass" : ""}`}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border text-left transition",
                  active
                    ? "border-primary/70 bg-primary/8 ring-1 ring-primary/30"
                    : "border-border/70 bg-card/60 hover:border-primary/40",
                  wrongLayout && "opacity-45",
                )}
              >
                <div className="relative aspect-[3/4] w-full bg-canvas p-1.5">
                  <FrameCanvas frame={frame} participantCount={participantCount} longEdge={300} />
                  {locked ? (
                    <span className="absolute right-1 top-1 rounded-full bg-card/95 p-1 text-pro shadow-sm">
                      <Lock className="h-2.5 w-2.5" aria-hidden />
                    </span>
                  ) : null}
                  {active ? (
                    <span className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                  ) : null}
                </div>
                <span className="block truncate px-2 py-1.5 text-[10px] font-medium text-foreground/85">{frame.name}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Bingkai yang diredupkan milik layout lain — pilih tata letaknya dulu.
        </p>
      </section>

      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Filter</h3>
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
                  "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition",
                  filter === item.id
                    ? "border-primary/60 bg-primary/12 text-foreground"
                    : "border-border/70 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <span className={cn("size-3 rounded-full border border-border", filterSwatch(item.id))} aria-hidden />
                {item.name}
                {locked ? <Lock className="h-2.5 w-2.5 text-pro" aria-hidden /> : null}
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
      return "bg-secondary/40";
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
