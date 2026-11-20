"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { FrameCanvas } from "@/components/FrameCanvas";
import { FRAMES, getFrame } from "@/lib/frames";
import { Pill } from "@/components/ui";
import { cn } from "@/lib/utils";

export function FrameGallery() {
  const [selected, setSelected] = useState(FRAMES[0].id);
  const frame = getFrame(selected);

  return (
    <section id="frame" className="relative z-10 mx-auto w-full max-w-7xl px-5 py-14 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <Pill>Koleksi frame</Pill>
          <h2 className="mt-4 max-w-lg text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            Sembilan bingkai plus satu frame galaxy, tiga tata letak.
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          Setiap frame dirender oleh mesin yang sama dengan hasil akhir, jadi tidak ada kejutan setelah kamu unduh.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.05fr]">
        <div className="surface grid grid-cols-3 gap-2 rounded-3xl p-3 sm:grid-cols-3">
          {FRAMES.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item.id)}
              aria-pressed={selected === item.id}
              className={cn(
                "group relative overflow-hidden rounded-2xl border text-left transition",
                selected === item.id
                  ? "border-primary/60 bg-primary/8 ring-1 ring-primary/25"
                  : "border-border/60 bg-card/60 hover:border-primary/40",
              )}
            >
              <div className="relative aspect-[3/4] w-full bg-canvas p-1.5">
                <FrameCanvas frame={item} participantCount={2} longEdge={320} />
                {item.isPremium ? (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-card/95 p-1 text-pro shadow-sm">
                    <Lock className="h-3 w-3" aria-hidden />
                  </span>
                ) : null}
              </div>
              <span className="block truncate px-2.5 py-2 text-[11px] font-medium text-foreground/85">{item.name}</span>
            </button>
          ))}
        </div>

        <div className="surface flex flex-col rounded-3xl p-5">
          <div className="relative mx-auto flex w-full max-w-sm flex-1 items-center justify-center">
            <div className="w-full rounded-2xl border border-border/60 bg-gradient-to-br from-secondary via-card to-accent p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:shadow-none">
              <div className="aspect-[3/4] w-full">
                <FrameCanvas frame={frame} participantCount={2} longEdge={820} />
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">{frame.name}</h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">{frame.description}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Pill tone={frame.isPremium ? "pro" : "neutral"}>
                {frame.isPremium ? "Session Pass" : "Free"}
              </Pill>
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {frame.layout.replace("_", " ")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
