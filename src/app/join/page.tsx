"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CircleAlert, Hash, Loader2, ScanLine } from "lucide-react";
import { Button, Logo, Pill } from "@/components/ui";
import { normalizeRoomCode } from "@/lib/utils";

export default function JoinPage() {
  return (
    <Suspense fallback={<JoinShell />}>
      <JoinForm />
    </Suspense>
  );
}

function JoinShell() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(111,159,224,0.18),transparent_55%)]" />
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 items-center justify-center px-5 pb-16">
        <Loader2 className="h-5 w-5 animate-spin text-white/30" />
      </div>
    </main>
  );
}

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const prefill = params.get("code") ?? "";
  useEffect(() => {
    if (prefill) setCode(normalizeRoomCode(prefill).slice(0, 6));
  }, [prefill]);

  const join = useCallback(
    async (value: string) => {
      const normalized = normalizeRoomCode(value);
      if (normalized.length !== 6) {
        setError("Kode ruang terdiri dari 6 digit.");
        return;
      }
      setChecking(true);
      setError(null);
      try {
        const response = await fetch(`/api/rooms?code=${normalized}`, { cache: "no-store" });
        if (!response.ok) {
          setError(
            response.status === 404
              ? "Kode tidak ditemukan. Cek lagi atau minta host membuat tautan baru."
              : "Gagal memeriksa kode ruangan.",
          );
          return;
        }
        const payload = (await response.json()) as { room?: { status?: string } };
        if (payload.room?.status === "expired") {
          setError("Sesi ini sudah berakhir. Minta host membuat ruang baru.");
          return;
        }
        router.push(`/room/${normalized}`);
      } catch {
        setError("Koneksi ke server gagal.");
      } finally {
        setChecking(false);
      }
    },
    [router],
  );

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(111,159,224,0.18),transparent_55%)]" />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/create">
          <Button variant="ghost" size="sm">
            Buat ruang baru
          </Button>
        </Link>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-16">
        <Pill tone="live">
          <ScanLine className="h-3 w-3" /> Gabung sesi
        </Pill>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Masukkan kode ruang</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          Kode 6 digit dari host. Kamu akan masuk ke green room untuk cek kamera sebelum bilik dibuka.
        </p>

        <form
          className="mt-7"
          onSubmit={(event) => {
            event.preventDefault();
            void join(code);
          }}
        >
          <label htmlFor="room-code" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Kode ruang
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/12 bg-black/40 px-4 py-1">
            <Hash className="h-4 w-4 shrink-0 text-white/30" />
            <input
              id="room-code"
              value={code}
              onChange={(event) => {
                setCode(normalizeRoomCode(event.target.value));
                setError(null);
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="••••••"
              className="w-full bg-transparent py-3.5 font-mono text-2xl tracking-[0.4em] text-white placeholder:text-white/20 focus:outline-none"
            />
          </div>

          {error ? (
            <p className="mt-3 inline-flex items-start gap-1.5 text-xs leading-relaxed text-amber-200">
              <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="mt-5 w-full" disabled={code.length !== 6 || checking}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {checking ? "Memeriksa kode…" : "Masuk ruangan"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-white/30">
          Tidak punya kode?{" "}
          <Link href="/create" className="text-white/60 underline-offset-4 hover:underline">
            Buat ruang sendiri
          </Link>{" "}
          — gratis dan tanpa login.
        </p>
      </div>
    </main>
  );
}
