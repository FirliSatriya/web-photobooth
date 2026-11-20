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
      <div className="min-w-0 space-y-4">
        <div className="surface overflow-hidden rounded-3xl">
          <div className="relative aspect-video min-h-[248px] w-full bg-neutral-900">
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
              <div className="absolute inset-x-0 top-0 bottom-[5.5rem] grid place-items-center bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--lilac)_18%,transparent),transparent_65%)] px-5 pt-6 text-center">
                {requesting ? (
                  <span className="inline-flex items-center gap-2 text-sm text-scrim/90">
                    <Loader2 className="h-4 w-4 animate-spin" /> Meminta izin kamera…
                  </span>
                ) : (
                  <div>
                    <VideoOff className="mx-auto size-5 text-brand sm:size-6" aria-hidden />
                    <p className="mt-2 max-w-xs text-xs leading-relaxed text-scrim/90 sm:text-sm">
                      {mediaError ?? "Kamera belum aktif. Nyalakan untuk cek framing sebelum masuk bilik."}
                    </p>
                    <Button className="mt-3" size="sm" onClick={onRetryMedia} loading={requesting}>
                      <Video className="h-4 w-4" aria-hidden /> Nyalakan kamera
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            <div className="absolute left-3 top-3 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-scrim/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-scrim backdrop-blur">
                <span className="size-1.5 rounded-full bg-mint" />
                {device.resolution ? `${device.resolution.width}×${device.resolution.height}` : "green room"}
              </span>
              {room.tier === "paid" ? (
                <Pill tone="pro">
                  <Crown className="h-2.5 w-2.5" /> Pass
                </Pill>
              ) : null}
            </div>

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-neutral-950/85 to-transparent px-3 pb-3 pt-8">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleCamera}
                  aria-label={cameraOn ? "Matikan kamera" : "Nyalakan kamera"}
                  aria-pressed={cameraOn}
                  className={cn(
                    "tap grid place-items-center rounded-full border backdrop-blur transition",
                    cameraOn
                      ? "border-scrim/40 bg-scrim/25 text-scrim hover:bg-scrim/40"
                      : "border-scrim/40 bg-scrim/20 text-scrim/80 hover:bg-scrim/35",
                  )}
                >
                  {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={onToggleMic}
                  aria-label={micOn ? "Matikan mikrofon" : "Nyalakan mikrofon"}
                  aria-pressed={micOn}
                  className={cn(
                    "tap grid place-items-center rounded-full border backdrop-blur transition",
                    micOn
                      ? "border-scrim/40 bg-scrim/25 text-scrim hover:bg-scrim/40"
                      : "border-scrim/40 bg-scrim/20 text-scrim/80 hover:bg-scrim/35",
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
                    "tap grid place-items-center rounded-full border backdrop-blur transition",
                    mirrored
                      ? "border-primary/60 bg-primary text-primary-foreground"
                      : "border-scrim/40 bg-scrim/20 text-scrim/80 hover:bg-scrim/35",
                  )}
                >
                  <FlipHorizontal2 className="h-4 w-4" />
                </button>
              </div>

              <span className="hidden items-center gap-1.5 text-[11px] text-scrim/85 sm:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Pratinjau lokal
              </span>
            </div>
          </div>
        </div>

        <div className="surface rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium">Perangkat & tampilan</h2>
            <span className="text-[11px] text-muted-foreground">Hot-plug didukung</span>
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
              <p className="mt-1 text-sm text-muted-foreground">
                Cek framing dan pilih bingkai. Sesi mulai saat host menekan tombol masuk.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Sisa sesi
              </span>
              <p
                className={cn(
                  "font-mono text-lg tabular-nums",
                  remainingMs < 60000 ? "font-semibold text-destructive" : "text-foreground",
                )}
              >
                {formatClock(remainingMs)}
              </p>
              <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                {sessionDuration(room.tier === "paid" ? 3600000 : 600000)}
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border/60 bg-canvas p-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Kode ruang
            </span>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="font-mono text-3xl tracking-[0.3em] text-foreground">{code}</span>
              <button
                type="button"
                onClick={() => void copy(code, "code")}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border/60 px-3.5 text-[11px] font-semibold text-foreground/80 transition hover:border-primary/50 hover:text-foreground"
              >
                {copied === "code" ? (
                  <Check className="h-3.5 w-3.5 text-mint" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
                {copied === "code" ? "Tersalin" : "Salin"}
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/40 pt-3">
              <code className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{shareUrl}</code>
              <button
                type="button"
                onClick={() => void copy(shareUrl, "link")}
                className="inline-flex h-10 shrink-0 items-center text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {copied === "link" ? "Tersalin" : "Salin tautan"}
              </button>
            </div>
            <QRCode value={shareUrl} size={132} className="mt-4" caption="Pindai untuk gabung dari ponsel" />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Peserta</span>
              <span className="text-[11px] text-muted-foreground">
                {readyCount}/{participants.length} siap
              </span>
            </div>
            <ul className="space-y-2">
              {participants.map((participant) => (
                <li
                  key={participant.peerId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-canvas px-3 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold uppercase text-secondary-foreground">
                      {participant.name.slice(0, 2)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {participant.name}
                        {participant.self ? " (kamu)" : ""}
                      </span>
                      <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {participant.isHost ? "host" : "tamu"}
                      </span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                      participant.ready ? "text-mint" : "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn("size-1.5 rounded-full", participant.ready ? "bg-mint" : "bg-input/60")}
                      aria-hidden
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
              <p className="text-center text-[11px] text-muted-foreground">Host akan membuka bilik sebentar lagi.</p>
            ) : null}
            {expired ? (
              <p role="alert" className="text-center text-[11px] font-semibold text-destructive">
                Waktu sesi habis. Buat ruang baru untuk melanjutkan.
              </p>
            ) : null}
          </div>

          {room.tier === "free" ? (
            <button
              type="button"
              onClick={onUnlock}
              className="mt-4 w-full rounded-2xl border border-pro/35 bg-pro/10 px-4 py-3 text-left transition hover:border-pro/60 hover:bg-pro/15"
            >
              <span className="flex items-center gap-1.5 text-sm font-bold text-pro">
                <Crown className="h-3.5 w-3.5" aria-hidden /> Buka Session Pass
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                60 menit, 4 peserta, 2K tanpa watermark, boomerang MP4, dan backdrop AI.
              </span>
            </button>
          ) : null}
        </div>

        <div className="surface rounded-3xl p-5">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Nama tampilan
            </span>
            <input
              value={selfName}
              onChange={(event) => onName(event.target.value.slice(0, 18))}
              maxLength={18}
              className="mt-2 h-11 w-full rounded-xl border border-input/60 bg-card px-3.5 text-sm text-foreground transition placeholder:text-muted-foreground focus:border-ring focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
              placeholder="Nama kamu"
            />
          </label>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Nama hanya dipakai di dalam ruangan dan tidak disimpan setelah sesi berakhir.
          </p>
        </div>
      </div>
    </div>
  );
}
