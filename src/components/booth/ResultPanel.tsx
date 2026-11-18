"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Film,
  ImageDown,
  RefreshCw,
  Share2,
  Sparkles,
  Timer,
} from "lucide-react";
import { Button, Pill } from "@/components/ui";
import { QRCode } from "@/components/booth/QRCode";
import { absoluteUrl, downloadAsset } from "@/lib/download";
import type { ShareOutput } from "@/lib/types";

export interface ResultPanelProps {
  output: ShareOutput;
  shareUrl: string;
  roomCode: string;
  isHost: boolean;
  retakeLabel: string;
  canRetake: boolean;
  onRetake: () => void;
  onNewSession: () => void;
  busy?: boolean;
}

export function ResultPanel({
  output,
  shareUrl,
  roomCode,
  isHost,
  retakeLabel,
  canRetake,
  onRetake,
  onNewSession,
  busy,
}: ResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState("");

  const imageSrc = useMemo(() => absoluteUrl(output.imageUrl), [output.imageUrl]);
  const videoSrc = useMemo(() => (output.videoUrl ? absoluteUrl(output.videoUrl) : null), [output.videoUrl]);

  useEffect(() => {
    const tick = () => {
      const left = Date.parse(output.expiresAt) - Date.now();
      if (left <= 0) {
        setExpiresIn("kedaluwarsa");
        return;
      }
      const hours = Math.floor(left / 3600000);
      const minutes = Math.floor((left % 3600000) / 60000);
      setExpiresIn(hours > 0 ? `${hours} jam ${minutes} menit` : `${minutes} menit`);
    };
    tick();
    const timer = window.setInterval(tick, 30000);
    return () => window.clearInterval(timer);
  }, [output.expiresAt]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Pill tone="live">
            <Sparkles className="h-3 w-3" /> Sesi selesai
          </Pill>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Hasil kamu sudah siap</h1>
          <p className="mt-1 text-sm text-white/45">
            Ruang {roomCode} · tautan aktif {expiresIn === "kedaluwarsa" ? "sudah habis" : `selama ${expiresIn}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" /> Beranda
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="surface min-w-0 overflow-hidden rounded-3xl p-3 sm:p-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f0e0c] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt="Hasil photostrip"
              className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => void downloadAsset(imageSrc, `photobooth-${roomCode}.png`)}
              disabled={busy}
            >
              <ImageDown className="h-4 w-4" /> Unduh PNG
            </Button>
            {videoSrc ? (
              <Button
                variant="secondary"
                onClick={() => void downloadAsset(videoSrc, `photobooth-${roomCode}-boomerang.mp4`)}
              >
                <Film className="h-4 w-4" /> Unduh boomerang
              </Button>
            ) : null}
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-white/35">
              <Timer className="h-3 w-3" /> hilang otomatis setelah 24 jam
            </span>
          </div>

          {videoSrc ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black">
              <video src={videoSrc} controls loop playsInline className="max-h-72 w-full" />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="surface rounded-3xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Share2 className="h-4 w-4 text-flame" /> Bagikan
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Pindai QR dari PC untuk menyimpan foto langsung ke ponsel, atau kirim tautannya.
            </p>

            <QRCode value={shareUrl} size={176} className="mt-5" />

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
              <code className="min-w-0 flex-1 truncate text-[11px] text-white/55">{shareUrl}</code>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-white/60 transition hover:border-white/30 hover:text-white"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Tersalin" : "Salin"}
              </button>
            </div>
          </div>

          <div className="surface rounded-3xl p-5">
            <h2 className="text-sm font-medium">Lanjutkan sesi</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Hasil saat ini tetap tersimpan di tautan di atas. Retake hanya mengulang slot yang dipilih.
            </p>
            <div className="mt-4 space-y-2">
              <Button className="w-full" variant="secondary" onClick={onRetake} disabled={!canRetake || busy}>
                <RefreshCw className="h-4 w-4" /> Ulangi jepretan ({retakeLabel})
              </Button>
              {isHost ? (
                <Button className="w-full" variant="outline" onClick={onNewSession} disabled={busy}>
                  <Download className="h-4 w-4" /> Mulai sesi baru
                </Button>
              ) : (
                <p className="text-center text-[11px] text-white/30">Host dapat memulai sesi baru dari perangkatnya.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4 text-[11px] leading-relaxed text-white/35">
            Foto diproses di perangkat peserta. Server hanya menyimpan hasil akhir sementara untuk tautan 24 jam,
            lalu menghapusnya otomatis lewat lifecycle rule.
          </div>
        </div>
      </div>
    </div>
  );
}
