"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Copy, Loader2, QrCode, RefreshCw, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button, Logo, Pill } from "@/components/ui";
import { QRCode } from "@/components/booth/QRCode";
import type { RoomCreateResponse } from "@/lib/types";

export default function CreatePage() {
  const router = useRouter();
  const [data, setData] = useState<RoomCreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const creatingRef = useRef(false);

  const create = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setError(null);
    try {
      const response = await fetch("/api/rooms", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as RoomCreateResponse & { error?: string };
      if (!response.ok || !payload.room) throw new Error(payload.error ?? "Gagal membuat ruangan");
      window.sessionStorage.setItem(`pb:host:${payload.room.code}`, payload.hostToken);
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat ruangan");
    } finally {
      creatingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void create();
  }, [create]);

  const shareUrl = data ? `${window.location.origin}/room/${data.room.code}` : "";

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(226,82,58,0.2),transparent_55%)]" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/join">
          <Button variant="ghost" size="sm">
            Gabung ruang
          </Button>
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-5xl gap-5 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-[1fr_0.85fr]">
        <div className="surface rounded-3xl p-6 sm:p-8">
          {!data && !error ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-flame" />
              <p className="text-sm text-white/55">Menyiapkan ruang photobooth…</p>
              <p className="max-w-xs text-xs text-white/30">
                Tanpa login. Kode 6 digit dan tautan dibuat dalam hitungan milidetik.
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-amber-200">{error}</p>
              <Button onClick={() => void create()}>
                <RefreshCw className="h-4 w-4" /> Coba lagi
              </Button>
            </div>
          ) : null}

          {data ? (
            <>
              <Pill tone="live">
                <Sparkles className="h-3 w-3" /> Ruang siap
              </Pill>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Bagikan kode ini</h1>
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                Maksimal {data.room.maxParticipants} peserta di tier gratis. Buka Session Pass kapan saja untuk 4
                peserta, 2K tanpa watermark, dan boomerang.
              </p>

              <div className="mt-6 rounded-2xl border border-white/12 bg-black/35 p-5">
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">Kode ruang</span>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="font-mono text-4xl tracking-[0.32em] text-white sm:text-5xl">
                    {data.room.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(data.room.code);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1600);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-[11px] text-white/60 transition hover:border-white/30 hover:text-white"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Tersalin" : "Salin"}
                  </button>
                </div>

                <div className="mt-4 border-t border-white/8 pt-3">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">Tautan undangan</span>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <code className="min-w-0 flex-1 truncate text-xs text-white/55">{shareUrl}</code>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(shareUrl)}
                      className="shrink-0 text-[11px] text-white/55 underline-offset-4 hover:text-white hover:underline"
                    >
                      Salin
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => router.push(`/room/${data.room.code}?host=1`)}
                >
                  Masuk ke green room
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => router.push("/join")}>
                  <Users className="h-4 w-4" /> Gabung sebagai tamu
                </Button>
              </div>

              <ul className="mt-6 grid gap-2 text-[11px] text-white/35 sm:grid-cols-3">
                <li className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Tanpa instal
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5" /> QR untuk ponsel
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Hasil 24 jam
                </li>
              </ul>
            </>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="surface rounded-3xl p-5">
            <h2 className="text-sm font-medium">Scan untuk gabung</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Buka kamera ponsel lalu pindai. Ideal untuk mengajak teman yang sedang di luar.
            </p>
            {data ? (
              <QRCode value={shareUrl} size={196} className="mt-5" caption="Tautan undangan ruang" />
            ) : (
              <div className="mt-5 grid h-[196px] w-[196px] place-items-center rounded-2xl bg-white/5">
                <QrCode className="h-6 w-6 text-white/20" />
              </div>
            )}
          </div>

          <div className="surface rounded-3xl p-5">
            <h2 className="text-sm font-medium">Yang perlu disiapkan</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-white/50">
              <li>1. Izinkan akses kamera & mikrofon di peramban.</li>
              <li>2. Pilih webcam eksternal bila ada (hot-plug terdeteksi).</li>
              <li>3. Atur mirror masing-masing — hasil akhir mengikuti.</li>
              <li>4. Host menekan “Mulai jepret” saat semua siap.</li>
            </ul>
          </div>

          {data?.paymentProvider === "demo" ? (
            <div className="rounded-3xl border border-amber-300/25 bg-amber-300/8 p-4 text-[11px] leading-relaxed text-amber-100/80">
              Mode demo aktif: kunci Midtrans belum diisi, jadi Session Pass terbuka otomatis saat kamu menekan tombol
              bayar. Isi <code className="text-amber-100">MIDTRANS_SERVER_KEY</code> untuk transaksi sungguhan.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
