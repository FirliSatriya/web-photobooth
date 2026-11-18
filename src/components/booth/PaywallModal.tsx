"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CreditCard, Loader2, QrCode, ShieldCheck, X } from "lucide-react";
import { Button, Pill } from "@/components/ui";
import { SESSION_PASS_PRICE_FALLBACK, rupiah } from "@/lib/pricing";

export interface PaywallModalProps {
  open: boolean;
  code: string;
  onClose: () => void;
  onUnlocked: () => void;
}

type Stage = "idle" | "creating" | "waiting" | "demo" | "done" | "error";

const BENEFITS = [
  "Hingga 60 menit & 4 peserta dalam satu frame",
  "Ultra HD 1080p/2K tanpa watermark",
  "Semua frame premium + filter sinematik",
  "Boomerang MP4 & AI Studio Backdrop",
  "Retake tanpa batas",
];

export function PaywallModal({ open, code, onClose, onUnlocked }: PaywallModalProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState(SESSION_PASS_PRICE_FALLBACK);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopPolling();
      setStage("idle");
      setMessage(null);
    }
    return stopPolling;
  }, [open, stopPolling]);

  const checkStatus = useCallback(async () => {
    const response = await fetch(`/api/rooms?code=${code}`, { cache: "no-store" });
    if (!response.ok) return false;
    const payload = (await response.json()) as { room?: { tier?: string } };
    if (payload.room?.tier === "paid") {
      stopPolling();
      setStage("done");
      onUnlocked();
      return true;
    }
    return false;
  }, [code, onUnlocked, stopPolling]);

  const start = async () => {
    setStage("creating");
    setMessage(null);
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = (await response.json()) as {
        provider?: string;
        redirectUrl?: string;
        token?: string;
        amount?: number;
        alreadyPaid?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Gagal memulai pembayaran");
      if (payload.alreadyPaid) {
        await checkStatus();
        return;
      }
      if (typeof payload.amount === "number") setAmount(payload.amount);

      if (payload.provider === "demo") {
        // No gateway keys configured: confirm the demo order so the paid
        // feature set stays testable end-to-end.
        setStage("demo");
        const confirm = await fetch("/api/payments/demo-confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (!confirm.ok) throw new Error("Demo unlock gagal");
        setStage("done");
        onUnlocked();
        return;
      }

      setStage("waiting");
      if (payload.redirectUrl) {
        window.open(payload.redirectUrl, "_blank", "noopener,noreferrer");
      }
      stopPolling();
      pollRef.current = window.setInterval(() => {
        void checkStatus();
      }, 3000);
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : "Pembayaran gagal dimulai");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="surface-strong w-full max-w-md overflow-hidden rounded-3xl">
        <div className="relative border-b border-white/10 bg-gradient-to-br from-flame/25 via-transparent to-transparent p-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <Pill tone="pro">
            <QrCode className="h-3 w-3" /> Session Pass
          </Pill>
          <h2 className="mt-3 text-xl font-semibold tracking-tight">Buka semua fitur untuk seluruh ruangan</h2>
          <p className="mt-1 text-sm text-white/50">
            Sekali bayar, semua peserta langsung dapat akses tanpa memuat ulang halaman.
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight">{rupiah(amount)}</span>
            <span className="text-xs text-white/40">/ ruangan</span>
          </div>

          <ul className="mt-4 space-y-2 text-sm text-white/70">
            {BENEFITS.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7ee2c8]" />
                {item}
              </li>
            ))}
          </ul>

          {message ? <p className="mt-4 text-xs leading-relaxed text-amber-200/80">{message}</p> : null}

          <div className="mt-5">
            {stage === "done" ? (
              <div className="flex items-center gap-2 rounded-2xl border border-[#7ee2c8]/30 bg-[#7ee2c8]/10 px-4 py-3 text-sm text-[#b6f2e3]">
                <Check className="h-4 w-4" /> Session Pass aktif.
              </div>
            ) : (
              <Button className="w-full" size="lg" loading={stage === "creating"} onClick={() => void start()}>
                <CreditCard className="h-4 w-4" />
                {stage === "waiting" ? "Menunggu pembayaran…" : `Bayar ${rupiah(amount)}`}
              </Button>
            )}
          </div>

          {stage === "waiting" ? (
            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-white/40">
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Cek status otomatis tiap 3 detik
              </span>
              <button type="button" className="underline hover:text-white" onClick={() => void checkStatus()}>
                Cek sekarang
              </button>
            </div>
          ) : (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/35">
              <ShieldCheck className="h-3 w-3" /> QRIS, GoPay, OVO, transfer bank — via Midtrans
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
