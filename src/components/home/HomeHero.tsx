"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Camera, Clock, Link2, QrCode, ShieldCheck, Sparkles, Star, Users } from "lucide-react";
import { Button, Card, Pill } from "@/components/ui";
import { FrameCanvas } from "@/components/FrameCanvas";
import { getFrame, FRAMES } from "@/lib/frames";
import { normalizeRoomCode } from "@/lib/utils";

const demoFrames = [FRAMES[7], FRAMES[9], FRAMES[0]];

export function HomeHero() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [active, setActive] = useState(0);

  return (
    <section className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-16 pt-6 sm:px-8 lg:pt-10">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="min-w-0 animate-float-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground shadow-sm backdrop-blur">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            WebRTC · Dual-stream capture
            <Star className="size-3 text-lilac" aria-hidden />
          </div>

          <h1 className="mt-6 text-balance text-[2.6rem] font-extrabold leading-[1.03] tracking-[-0.03em] text-foreground sm:text-6xl">
            Foto bareng
            <br />
            <span className="bg-gradient-to-r from-primary via-brand to-lilac bg-clip-text text-transparent">
              walau beda kota.
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Bilik photobooth virtual untuk 2–4 orang. Live preview gabungan, jepretan sinkron di bawah 50&nbsp;ms,
            lalu hasilnya keluar tajam — bukan screenshot video yang buram.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/create" className="sm:w-auto">
              <Button size="lg" className="w-full animate-pulse-ring sm:w-auto">
                <Camera className="size-4" aria-hidden />
                Buat ruang gratis
              </Button>
            </Link>
            <Button
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => router.push("/join")}
            >
              Saya punya kode
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>

          <form
            className="mt-6 flex max-w-md items-center gap-2 rounded-2xl border border-border/85 bg-card/80 p-1.5 shadow-sm backdrop-blur"
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = normalizeRoomCode(code);
              if (normalized.length === 6) router.push(`/join?code=${normalized}`);
            }}
          >
            <label htmlFor="hero-room-code" className="sr-only">
              Kode ruang
            </label>
            <input
              id="hero-room-code"
              value={code}
              onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Kode ruang 6 digit"
              className="w-full rounded-xl bg-transparent px-3 py-2 text-sm tracking-[0.28em] text-foreground placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:outline-none"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={code.length !== 6}>
              Masuk
            </Button>
          </form>

          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-lilac" aria-hidden /> Tanpa instal
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 text-lilac" aria-hidden /> Hasil hilang 24 jam
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Users className="size-3.5 text-lilac" aria-hidden /> 2–4 orang
            </li>
          </ul>
        </div>

        <div className="relative min-w-0 animate-float-up [animation-delay:120ms]">
          <div className="aura absolute -inset-8 -z-10 rounded-[3rem]" />

          <Card className="grain relative overflow-hidden p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pill tone="live">Live preview</Pill>
                <span className="text-[11px] text-muted-foreground">room 884216</span>
              </div>
              <div className="-mr-2 flex items-center">
                {demoFrames.map((frame, index) => (
                  <button
                    key={frame.id}
                    onClick={() => setActive(index)}
                    aria-label={`Lihat frame ${frame.name}`}
                    aria-pressed={active === index}
                    className="tap grid place-items-center rounded-full"
                  >
                    <span
                      className={`block size-2.5 rounded-full transition ${
                        active === index ? "bg-primary" : "bg-input/50 hover:bg-brand"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="relative grid gap-3 sm:h-[330px] sm:grid-cols-[1.1fr_0.9fr]">
              <div className="relative flex aspect-[4/3] flex-col overflow-hidden rounded-2xl border border-border/80 bg-neutral-950 shadow-lg sm:aspect-auto sm:h-full">
                <div className="grid min-h-0 flex-1 grid-cols-2 gap-px bg-scrim/15 p-px">
                  {[0, 1].map((cell) => (
                    <div key={cell} className="relative overflow-hidden bg-neutral-900">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,color-mix(in_oklab,var(--brand)_28%,transparent),transparent_62%)]" />
                      <div className="absolute left-1/2 top-[44%] size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/45" />
                      <div className="absolute left-1/2 top-[72%] h-12 w-16 -translate-x-1/2 rounded-t-full bg-accent/30" />
                      <span className="absolute bottom-2 left-2 rounded-md bg-scrim/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-scrim backdrop-blur">
                        {cell === 0 ? "Kamu" : "Tamu"}
                      </span>
                      <span className="absolute right-2 top-2 size-1.5 rounded-full bg-mint" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-scrim/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-scrim/75">
                  <span>2 peserta</span>
                  <span className="text-mint">sync 18 ms</span>
                </div>
              </div>

              <div className="relative flex h-[300px] items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-secondary via-card to-accent p-3 sm:h-full">
                <div className="sparkle pointer-events-none absolute inset-0 opacity-80" />
                <div className="pointer-events-none absolute -bottom-10 -right-8 size-32 rounded-full bg-lilac/30 blur-2xl" />
                <div className="pointer-events-none absolute -left-8 -top-10 size-28 rounded-full bg-primary/20 blur-2xl" />
                <div className="relative h-full w-full">
                  <FrameCanvas frame={demoFrames[active]} participantCount={2} longEdge={520} />
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5 text-lilac" /> Unduh di HP lewat QR
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-lilac" /> {getFrame(demoFrames[active].id).name}
              </span>
            </div>
          </Card>

          <div className="surface mt-4 flex items-center justify-between rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">
                Frame favorit berganti tiap minggu — mulai dari <span className="text-foreground">Rp 12.000</span> per sesi.
              </p>
            </div>
            <Link
              href="#frame"
              className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition hover:text-primary"
            >
              Lihat
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
