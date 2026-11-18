"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Camera, Clock, Link2, QrCode, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button, Card, Pill } from "@/components/ui";
import { FrameCanvas } from "@/components/FrameCanvas";
import { getFrame, FRAMES } from "@/lib/frames";
import { normalizeRoomCode } from "@/lib/utils";

const demoFrames = [FRAMES[1], FRAMES[0], FRAMES[5]];

export function HomeHero() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [active, setActive] = useState(0);

  return (
    <section className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-16 pt-6 sm:px-8 lg:pt-10">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-float-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/55">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flame/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-flame" />
            </span>
            WebRTC · Dual-stream capture
          </div>

          <h1 className="mt-6 text-balance text-[2.6rem] font-semibold leading-[1.03] tracking-[-0.02em] sm:text-6xl">
            Foto bareng
            <br />
            <span className="text-white/40">walau beda kota.</span>
          </h1>

          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-white/55">
            Bilik photobooth virtual untuk 2–4 orang. Live preview gabungan, jepretan sinkron di bawah 50&nbsp;ms,
            lalu hasilnya keluar tajam — bukan screenshot video yang buram.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/create" className="sm:w-auto">
              <Button size="lg" className="w-full animate-pulse-ring sm:w-auto">
                <Camera className="h-4.5 w-4.5" />
                Buat ruang gratis
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => router.push("/join")}
            >
              Saya punya kode
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <form
            className="mt-6 flex max-w-md items-center gap-2 rounded-2xl border border-white/10 bg-black/25 p-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = normalizeRoomCode(code);
              if (normalized.length === 6) router.push(`/join?code=${normalized}`);
            }}
          >
            <input
              value={code}
              onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
              inputMode="numeric"
              placeholder="Kode ruang 6 digit"
              aria-label="Kode ruang"
              className="w-full bg-transparent px-3 py-2 text-sm tracking-[0.28em] text-white/85 placeholder:tracking-normal placeholder:text-white/30 focus:outline-none"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={code.length !== 6}>
              Masuk
            </Button>
          </form>

          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.14em] text-white/35">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Tanpa instal
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Hasil hilang 24 jam
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> 2–4 orang
            </span>
          </div>
        </div>

        <div className="relative animate-float-up [animation-delay:120ms]">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(circle_at_70%_10%,rgba(226,82,58,0.22),transparent_60%)] blur-2xl" />

          <Card className="grain relative overflow-hidden p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pill tone="live">Live preview</Pill>
                <span className="text-[11px] text-white/35">room 884216</span>
              </div>
              <div className="flex gap-1.5">
                {demoFrames.map((frame, index) => (
                  <button
                    key={frame.id}
                    onClick={() => setActive(index)}
                    aria-label={`Lihat frame ${frame.name}`}
                    className={`h-2 w-2 rounded-full transition ${
                      active === index ? "bg-flame" : "bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="relative grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#22201d] to-[#141210]">
                <div className="aspect-[4/3] w-full">
                  <div className="grid h-full w-full grid-cols-2 gap-px bg-white/5 p-px">
                    {[0, 1].map((cell) => (
                      <div key={cell} className="relative overflow-hidden bg-[#1e1c19]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.16),transparent_62%)]" />
                        <div className="absolute left-1/2 top-[42%] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15" />
                        <div className="absolute left-1/2 top-[70%] h-12 w-16 -translate-x-1/2 rounded-t-full bg-white/10" />
                        <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-white/60">
                          {cell === 0 ? "Kamu" : "Tamu"}
                        </span>
                        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/8 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white/40">
                  <span>2 peserta</span>
                  <span className="text-[#7ee2c8]">sync 18 ms</span>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#12100e] p-2">
                <div className="h-full w-full">
                  <FrameCanvas frame={demoFrames[active]} participantCount={2} longEdge={520} />
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-white/40">
              <span className="inline-flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5" /> Unduh di HP lewat QR
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> {getFrame(demoFrames[active].id).name}
              </span>
            </div>
          </Card>

          <div className="surface mt-4 flex items-center justify-between rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-[#f6d9a8]" />
              <p className="text-xs text-white/55">
                Frame favorit berganti tiap minggu — mulai dari <span className="text-white/80">Rp 12.000</span> per sesi.
              </p>
            </div>
            <Link href="#frame" className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-white/50 hover:text-white">
              Lihat
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
