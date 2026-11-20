"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CreditCard, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { Button, Pill } from "@/components/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent
        showCloseButton
        className="w-full max-w-md gap-0 overflow-hidden rounded-3xl border-border/70 bg-card p-0 shadow-2xl"
      >
        <div className="relative border-b border-border/60 bg-gradient-to-br from-primary/15 via-card to-accent/60 p-5">
          <Pill tone="pro">
            <QrCode className="h-3 w-3" aria-hidden /> Session Pass
          </Pill>
          <DialogTitle className="mt-3 text-xl font-bold tracking-tight">
            Buka semua fitur untuk seluruh ruangan
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            Sekali bayar, semua peserta langsung dapat akses tanpa memuat ulang halaman.
          </DialogDescription>
        </div>

        <div className="p-5">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight">{rupiah(amount)}</span>
            <span className="text-xs text-muted-foreground">/ ruangan</span>
          </div>

          <ul className="mt-4 space-y-2 text-sm text-foreground/85">
            {BENEFITS.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
                {item}
              </li>
            ))}
          </ul>

          {message ? (
            <p role="alert" className="mt-4 text-xs leading-relaxed text-destructive">
              {message}
            </p>
          ) : null}

          <div className="mt-5">
            {stage === "done" ? (
              <div className="flex items-center gap-2 rounded-2xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm font-semibold text-mint">
                <Check className="h-4 w-4" aria-hidden /> Session Pass aktif.
              </div>
            ) : (
              <Button className="w-full" size="lg" loading={stage === "creating"} onClick={() => void start()}>
                <CreditCard className="h-4 w-4" aria-hidden />
                {stage === "waiting" ? "Menunggu pembayaran…" : `Bayar ${rupiah(amount)}`}
              </Button>
            )}
          </div>

          {stage === "waiting" ? (
            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Cek status otomatis tiap 3 detik
              </span>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-full px-2 font-semibold text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => void checkStatus()}
              >
                Cek sekarang
              </button>
            </div>
          ) : (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" aria-hidden /> QRIS, GoPay, OVO, transfer bank — via Midtrans
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
