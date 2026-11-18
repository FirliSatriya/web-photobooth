"use client";

import { Loader2, Lock, Sparkles, Wand2 } from "lucide-react";
import type { BackdropPreset } from "@/lib/backdrop";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui";

export interface BackdropPickerProps {
  presets: BackdropPreset[];
  presetId: string;
  enabled: boolean;
  ready: boolean;
  loading: boolean;
  error: string | null;
  locked: boolean;
  onToggle: (enabled: boolean) => void;
  onPreset: (id: string) => void;
  onUnlock: () => void;
}

/** AI Virtual Studio Backdrop (PRD 5.C — Session Pass only). */
export function BackdropPicker({
  presets,
  presetId,
  enabled,
  ready,
  loading,
  error,
  locked,
  onToggle,
  onPreset,
  onUnlock,
}: BackdropPickerProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <Toggle
        checked={enabled && !locked}
        onChange={(value) => (locked ? onUnlock() : onToggle(value))}
        label="AI Studio Backdrop"
        description="Segmentasi on-device (MediaPipe) — video tidak pernah keluar dari perangkat."
      />

      {locked ? (
        <button
          type="button"
          onClick={onUnlock}
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#f6d9a8] hover:underline"
        >
          <Lock className="h-3 w-3" /> Termasuk Session Pass
        </button>
      ) : null}

      {enabled && !locked ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPreset(preset.id)}
                aria-pressed={presetId === preset.id}
                className={cn(
                  "overflow-hidden rounded-xl border text-left transition",
                  presetId === preset.id ? "border-flame/70" : "border-white/10 hover:border-white/30",
                )}
              >
                <span
                  className="block h-9 w-full"
                  style={{
                    background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})`,
                  }}
                />
                <span className="block truncate px-2 py-1 text-[10px] text-white/55">{preset.name}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <p className="inline-flex items-center gap-2 text-[11px] text-white/45">
              <Loader2 className="h-3 w-3 animate-spin" /> Memuat model segmentasi…
            </p>
          ) : error ? (
            <p className="text-[11px] leading-relaxed text-amber-200/80">{error}</p>
          ) : ready ? (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-[#7ee2c8]">
              <Sparkles className="h-3 w-3" /> Backdrop aktif, diproses lokal.
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-white/40">
              <Wand2 className="h-3 w-3" /> Menyiapkan pipeline…
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
