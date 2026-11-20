"use client";

import { useEffect, useRef } from "react";

export interface StageSize {
  shots: number;
  layout: "1x4_strip" | "2x2_grid" | "1x2_wide";
  participantCount: number;
}

/**
 * Decides the export resolution. Free output is capped at HD (720p long edge)
 * and paid sessions get UHD (2K long edge), matching the PRD tier table.
 */
export function exportLongEdge(tier: "free" | "paid", participantCount: number): number {
  if (tier === "paid") return participantCount >= 3 ? 2560 : 2880;
  return 1280;
}

/** Runs the shutter flash + audio cue in sync on every device. */
export function useShutterEffects(enabled: boolean) {
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return () => {
      void audioRef.current?.close();
      audioRef.current = null;
    };
  }, [enabled]);

  const flash = () => {
    const overlay = document.createElement("div");
    overlay.className = "pointer-events-none fixed inset-0 z-[120] bg-card";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 90ms ease-out";
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = "0.92";
    });
    window.setTimeout(() => {
      overlay.style.transition = "opacity 260ms ease-in";
      overlay.style.opacity = "0";
    }, 110);
    window.setTimeout(() => overlay.remove(), 420);
  };

  const click = async () => {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      if (!audioRef.current) audioRef.current = new Ctor();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const now = ctx.currentTime;
      // mechanical "ka-chik": short noise burst + click transient
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.09, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        const decay = Math.pow(1 - i / data.length, 3);
        data[i] = (Math.random() * 2 - 1) * decay * 0.5;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.55, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2200;
      filter.Q.value = 0.9;
      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(now);

      const click2 = ctx.createBufferSource();
      click2.buffer = buffer;
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.0001, now + 0.11);
      gain2.gain.exponentialRampToValueAtTime(0.32, now + 0.118);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
      click2.connect(filter).connect(gain2).connect(ctx.destination);
      click2.start(now + 0.11);
    } catch {
      /* audio is a garnish, never block the capture */
    }
  };

  return { flash, click, trigger: () => { flash(); void click(); } };
}
