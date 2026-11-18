"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Crown,
  Loader2,
  LogIn,
  Mic,
  MicOff,
  FlipHorizontal2,
  ShieldCheck,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { Button, Pill } from "@/components/ui";
import { QRCode } from "@/components/booth/QRCode";
import { DevicePicker, UvcPanel, type DevicePickerProps, type UvcPanelProps } from "@/components/booth/DevicePicker";
import { BackdropPicker, type BackdropPickerProps } from "@/components/booth/BackdropPicker";
import type { PublicRoom } from "@/lib/types";
import { sessionDuration } from "@/lib/pricing";
import { cn, formatClock } from "@/lib/utils";

export interface LobbyParticipant {
  peerId: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  self: boolean;
}

export interface LobbyPanelProps {
  room: PublicRoom;
  code: string;
  shareUrl: string;
  isHost: boolean;
  participants: LobbyParticipant[];
  selfName: string;
  onName: (name: string) => void;
  mirrored: boolean;
  onMirror: (value: boolean) => void;
  /** Local camera stream; the lobby owns its own <video> so the capture
   * element in the booth keeps a stable ref when this panel unmounts. */
  stream: MediaStream | null;
  cameraOn: boolean;
  micOn: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  mediaError: string | null;
  requesting: boolean;
  onRetryMedia: () => void;
  device: Omit<DevicePickerProps, "disabled">;
  uvc: UvcPanelProps;
  backdrop: BackdropPickerProps;
  remainingMs: number;
  expired: boolean;
  onUnlock: () => void;
  onReady: () => void;
  ready: boolean;
  waitingForHost: boolean;
}

export function LobbyPanel({
  room,
  code,
  shareUrl,
  isHost,
  participants,
  selfName,
  onName,
  mirrored,
  onMirror,
  stream,
  cameraOn,
  micOn,
  onToggleCamera,
  onToggleMic,
  mediaError,
  requesting,
  onRetryMedia,
  device,
  uvc,
  backdrop,
  remainingMs,
  expired,
  onUnlock,
  onReady,
  ready,
  waitingForHost,
}: LobbyPanelProps) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [stream]);

  const copy = async (value: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard may be blocked, the value stays readable */
    }
  };

  const readyCount = participants.filter((participant) => participant.ready).length;
  const canEnter = isHost && participants.length >= 1 && !expired;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <div className="surface overflow-hidden rounded-3xl">
          <div className="relative aspect-video w-full bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "h-full w-full object-cover transition-opacity duration-300",
                mirrored && "-scale-x-100",
                !cameraOn && "opacity-0",
              )}
            />
            {!cameraOn ? (
              <div className="absolute inset-0 grid place-items-center gap-3 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.08),transparent_65%)] text-center">
                {requesting ? (
                  <span className="inline-flex items-center gap-2 text-sm text-white/60">
                    <Loader2 className="h-4 w-4 animate-spin" /> Meminta izin kamera…
                  </span>
                ) : (
                  <div className="px-6">
                    <VideoOff className="mx-auto h-6 w-6 text-white/40" />
                    <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">
                      {mediaError ?? "Kamera belum aktif. Nyalakan untuk cek framing sebelum masuk bilik."}
                    </p>
                    <Button className="mt-4" onClick={onRetryMedia} loading={requesting}>
                      <Video className="h-4 w-4" /> Nyalakan kamera
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            <div className="absolute left-3 top-3 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/70 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {device.resolution ? `${device.resolution.width}×${device.resolution.height}` : "green room"}
              </span>
              {room.tier === "paid" ? (
                <Pill tone="pro">
                  <Crown className="h-2.5 w-2.5" /> Pass
                </Pill>
              ) : null}
            </div>

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-8">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleCamera}
                  aria-label={cameraOn ? "Matikan kamera" : "Nyalakan kamera"}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition",
                    cameraOn
                      ? "border-white/15 bg-black/50 text-white/80 hover:bg-black/70"
                      : "border-white/15 bg-white/10 text-white/50 hover:bg-white/20",
                  )}
                >
                  {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={onToggleMic}
                  aria-label={micOn ? "Matikan mikrofon" : "Nyalakan mikrofon"}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition",
                    micOn
                      ? "border-white/15 bg-black/50 text-white/80 hover:bg-black/70"
                      : "border-white/15 bg-white/10 text-white/50 hover:bg-white/20",
                  )}
                >
                  {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => onMirror(!mirrored)}
                  aria-pressed={mirrored}
                  aria-label="Balik tampilan kamera"
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition",
                    mirrored
                      ? "border-flame/50 bg-flame/25 text-white"
                      : "border-white/15 bg-black/50 text-white/60 hover:text-white",
                  )}
                >
                  <FlipHorizontal2 className="h-4 w-4" />
                </button>
              </div>

              <span className="inline-flex items-center gap-1.5 text-[11px] text-white/50">
                <ShieldCheck className="h-3.5 w-3.5" /> Pratinjau lokal
              </span>
            </div>
          </div>
        </div>

        <div className="surface rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium">Perangkat & tampilan</h2>
            <span className="text-[11px] text-white/35">Hot-plug didukung</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DevicePicker {...device} />
            <div className="space-y-3">
              <UvcPanel {...uvc} />
              <BackdropPicker {...backdrop} />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="surface rounded-3xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Pill tone={room.status === "active" ? "live" : "neutral"}>
                <Users className="h-3 w-3" /> {participants.length}/{room.maxParticipants}
              </Pill>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight">Green room</h1>
              <p className="mt-1 text-sm text-white/45">
                Cek framing dan pilih bingkai. Sesi mulai saat host menekan tombol masuk.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-[0.16em] text-white/35">Sisa sesi</span>
              <p className={cn("font-mono text-lg", remainingMs < 60000 ? "text-amber-300" : "text-white/80")}>
                {formatClock(remainingMs)}
              </p>
              <span className="text-[10px] text-white/30">{sessionDuration(room.tier === "paid" ? 3600000 : 600000)}</span>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">Kode ruang</span>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="font-mono text-3xl tracking-[0.3em] text-white">{code}</span>
              <button
                type="button"
                onClick={() => void copy(code, "code")}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-[11px] text-white/60 transition hover:border-white/30 hover:text-white"
              >
                {copied === "code" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied === "code" ? "Tersalin" : "Salin"}
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-3">
              <code className="min-w-0 flex-1 truncate text-[11px] text-white/45">{shareUrl}</code>
              <button
                type="button"
                onClick={() => void copy(shareUrl, "link")}
                className="shrink-0 text-[11px] text-white/55 underline-offset-4 hover:text-white hover:underline"
              >
                {copied === "link" ? "Tersalin" : "Salin tautan"}
              </button>
            </div>
            <QRCode value={shareUrl} size={132} className="mt-4" caption="Pindai untuk gabung dari ponsel" />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Peserta</span>
              <span className="text-[11px] text-white/35">
                {readyCount}/{participants.length} siap
              </span>
            </div>
            <ul className="space-y-2">
              {participants.map((participant) => (
                <li
                  key={participant.peerId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-semibold uppercase text-white/70">
                      {participant.name.slice(0, 2)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white/80">
                        {participant.name}
                        {participant.self ? " (kamu)" : ""}
                      </span>
                      <span className="block text-[10px] uppercase tracking-[0.14em] text-white/30">
                        {participant.isHost ? "host" : "tamu"}
                      </span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]",
                      participant.ready ? "text-[#7ee2c8]" : "text-white/30",
                    )}
                  >
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", participant.ready ? "bg-[#7ee2c8]" : "bg-white/25")}
                    />
                    {participant.ready ? "siap" : "menunggu"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 space-y-2">
            {isHost ? (
              <Button className="w-full" size="lg" disabled={!canEnter} onClick={onReady}>
                <LogIn className="h-4 w-4" />
                Masuk ke bilik ({participants.length})
              </Button>
            ) : (
              <Button className="w-full" size="lg" variant={ready ? "secondary" : "primary"} onClick={onReady}>
                {ready ? (
                  <>
                    <Check className="h-4 w-4" /> Kamu siap — menunggu host
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" /> Saya siap
                  </>
                )}
              </Button>
            )}
            {waitingForHost ? (
              <p className="text-center text-[11px] text-white/35">Host akan membuka bilik sebentar lagi.</p>
            ) : null}
            {expired ? (
              <p className="text-center text-[11px] text-amber-300/80">
                Waktu sesi habis. Buat ruang baru untuk melanjutkan.
              </p>
            ) : null}
          </div>

          {room.tier === "free" ? (
            <button
              type="button"
              onClick={onUnlock}
              className="mt-4 w-full rounded-2xl border border-[#f6d9a8]/30 bg-[#f6d9a8]/8 px-4 py-3 text-left transition hover:border-[#f6d9a8]/60"
            >
              <span className="block text-sm font-medium text-[#f6d9a8]">Buka Session Pass</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-white/45">
                60 menit, 4 peserta, 2K tanpa watermark, boomerang MP4, dan backdrop AI.
              </span>
            </button>
          ) : null}
        </div>

        <div className="surface rounded-3xl p-5">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Nama tampilan</span>
            <input
              value={selfName}
              onChange={(event) => onName(event.target.value.slice(0, 18))}
              maxLength={18}
              className="mt-2 w-full rounded-xl border border-white/12 bg-black/35 px-3.5 py-2.5 text-sm text-white/90 focus:border-white/35 focus:outline-none focus:ring-2 focus:ring-white/10"
              placeholder="Nama kamu"
            />
          </label>
          <p className="mt-3 text-[11px] leading-relaxed text-white/35">
            Nama hanya dipakai di dalam ruangan dan tidak disimpan setelah sesi berakhir.
          </p>
        </div>
      </div>
    </div>
  );
}
