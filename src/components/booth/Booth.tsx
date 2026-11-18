"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Aperture,
  Camera,
  CircleAlert,
  Crown,
  Layers,
  Loader2,
  LogOut,
  FlipHorizontal2,
  RefreshCw,
  Timer,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button, Logo, Pill, Progress } from "@/components/ui";
import { AppGate } from "@/components/AppGate";
import { LobbyPanel, type LobbyParticipant } from "@/components/booth/LobbyPanel";
import { StagePreview, type StageSource } from "@/components/booth/StagePreview";
import { FramePicker } from "@/components/booth/FramePicker";
import { DevicePicker, UvcPanel } from "@/components/booth/DevicePicker";
import { BackdropPicker } from "@/components/booth/BackdropPicker";
import { PaywallModal } from "@/components/booth/PaywallModal";
import { ResultPanel } from "@/components/booth/ResultPanel";
import { useLocalMedia, applyUvc, type UvcState } from "@/hooks/useLocalMedia";
import { useSignaling } from "@/hooks/useSignaling";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useMediaWorker } from "@/hooks/useMediaWorker";
import { useShutterEffects, exportLongEdge } from "@/hooks/useEffects";
import { useCountdown, useRoomLimits } from "@/hooks/useSession";
import { useVirtualBackdrop } from "@/lib/backdrop";
import { ChunkAssembler, bufferFromBlob, splitChunks } from "@/lib/chunking";
import { applySample, EMPTY_CLOCK, hostToLocal, resolvePong, type ClockState, type PendingPing } from "@/lib/clock";
import { captureFrame, captureSource, scheduleAt, type CapturedFrame } from "@/lib/capture";
import { encodeDataText, parseDataText } from "@/lib/protocol";
import { defaultFrameForLayout, getFrame, FRAMES, filterAvailable } from "@/lib/frames";
import {
  limitsFor,
  type FilterId,
  type LayoutType,
  type PublicRoom,
  type ShareOutput,
  type SignalMessage,
  type Tier,
} from "@/lib/types";
import { LAYOUT_SHOTS } from "@/lib/layout";
import type { CellFeed } from "@/lib/stage";
import { pruneOldShots, putRawShot } from "@/lib/storage/idb";
import { cn, formatClock, formatDateStamp, normalizeRoomCode, uid } from "@/lib/utils";

const COUNTDOWN_MS = 3000;
const SHOT_TIMEOUT_MS = 7000;

interface Captured {
  blob: Blob;
  width: number;
  height: number;
}

type Phase = "lobby" | "booth" | "result";
type Busy = null | "capture" | "compose" | "upload";

export function Booth({ code }: { code: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <BoothSkeleton code={code} />;
  return (
    <AppGate>
      <BoothSession code={code} />
    </AppGate>
  );
}

function BoothSkeleton({ code }: { code: string }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col items-center justify-center gap-3 px-5">
      <Loader2 className="h-5 w-5 animate-spin text-white/40" />
      <p className="text-sm text-white/45">Menyiapkan ruang {code}…</p>
    </div>
  );
}

function readName(): string {
  const stored = window.sessionStorage.getItem("pb:name");
  if (stored) return stored;
  const pool = ["Kopi", "Senja", "Lumen", "Pandan", "Kamboja", "Aurora", "Karang", "Melati"];
  const generated = `${pool[Math.floor(Math.random() * pool.length)]} ${Math.floor(Math.random() * 90 + 10)}`;
  window.sessionStorage.setItem("pb:name", generated);
  return generated;
}

function BoothSession({ code }: { code: string }) {
  const router = useRouter();

  // ------------------------------------------------------------------ identity
  const [identity] = useState(() => {
    const peerKey = `pb:peer:${code}`;
    let id = window.sessionStorage.getItem(peerKey);
    if (!id) {
      id = uid("peer");
      window.sessionStorage.setItem(peerKey, id);
    }
    const joinKey = `pb:joined:${code}`;
    let joinedAt = Number(window.sessionStorage.getItem(joinKey) ?? 0);
    if (!joinedAt) {
      joinedAt = Date.now();
      window.sessionStorage.setItem(joinKey, String(joinedAt));
    }
    return { id, joinedAt };
  });

  const [selfName, setSelfName] = useState(() => readName());

  const [isHost] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("host") === "1") {
      window.sessionStorage.setItem(`pb:host:${code}`, "1");
      return true;
    }
    return Boolean(window.sessionStorage.getItem(`pb:host:${code}`));
  });

  // --------------------------------------------------------------------- room
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);

  const loadRoom = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms?code=${code}`, { cache: "no-store" });
      if (!response.ok) {
        setRoomError(
          response.status === 404 ? "Ruangan tidak ditemukan atau sudah kedaluwarsa." : "Gagal memuat ruangan.",
        );
        return null;
      }
      const payload = (await response.json()) as { room: PublicRoom };
      setRoom(payload.room);
      setRoomError(null);
      return payload.room;
    } catch {
      setRoomError("Koneksi ke server gagal.");
      return null;
    } finally {
      setLoadingRoom(false);
    }
  }, [code]);

  useEffect(() => {
    void loadRoom();
    void pruneOldShots(code).catch(() => undefined);
  }, [code, loadRoom]);

  const tier: Tier = room?.tier ?? "free";
  const limits = limitsFor(tier);

  const sessionEndsAt = useMemo(() => {
    if (!room) return null;
    const created = Date.parse(room.createdAt) + limits.durationMs;
    const expiry = Date.parse(room.expiresAt);
    return new Date(Math.min(created, expiry)).toISOString();
  }, [room, limits.durationMs]);

  const session = useRoomLimits(sessionEndsAt, room?.retakesUsed ?? 0, room?.maxRetakes ?? 1);

  // --------------------------------------------------------------------- media
  const media = useLocalMedia();
  const requestedRef = useRef(false);
  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    void media.request({ withAudio: true });
  }, [media]);

  const [mirrored, setMirrored] = useState(false);
  const [uvc, setUvc] = useState<UvcState>({ zoom: 100, exposure: 120, whiteBalance: 5200 });
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const [phase, setPhase] = useState<Phase>("lobby");
  const [busy, setBusy] = useState<Busy>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [shotIndex, setShotIndex] = useState(0);
  const [filled, setFilled] = useState(0);
  const [awaitingResult, setAwaitingResult] = useState(false);
  const [review, setReview] = useState<Array<{ shotIndex: number; url: string }>>([]);
  const [output, setOutput] = useState<ShareOutput | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [readyPeers, setReadyPeers] = useState<string[]>([]);
  const [selfReady, setSelfReady] = useState(false);
  const [clock, setClock] = useState<ClockState>(EMPTY_CLOCK);
  const [toolOpen, setToolOpen] = useState(false);

  // ------------------------------------------------------------------- visuals
  const [layout, setLayout] = useState<LayoutType>("1x4_strip");
  const [frameId, setFrameId] = useState<string>(() => defaultFrameForLayout("1x4_strip", "free").id);
  const [filter, setFilter] = useState<FilterId>("none");
  const initialisedRef = useRef(false);

  useEffect(() => {
    if (!room || initialisedRef.current) return;
    initialisedRef.current = true;
    const stored = room.selectedFrameId ? FRAMES.find((item) => item.id === room.selectedFrameId) : undefined;
    const next = stored ?? defaultFrameForLayout(room.layout, room.tier);
    setLayout(next.layout);
    setFrameId(next.id);
  }, [room]);

  const frame = getFrame(frameId);

  // --------------------------------------------------------------------- hooks
  const { send, subscribe, status: signalStatus, mode: signalMode } = useSignaling(code, identity.id);
  const shutter = useShutterEffects(true);
  const countdown = useCountdown();
  const worker = useMediaWorker();
  const backdrop = useVirtualBackdrop();

  // ---------------------------------------------------------------------- refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const stageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backdropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shotsRef = useRef(new Map<number, Map<string, Captured>>());
  const waitersRef = useRef(new Map<number, () => void>());
  const expectedRef = useRef<string[]>([identity.id]);
  const assemblerRef = useRef(new ChunkAssembler());
  const pendingPingsRef = useRef<PendingPing[]>([]);
  const clockRef = useRef<ClockState>(EMPTY_CLOCK);
  const sendToRef = useRef<(peerId: string, data: ArrayBuffer | string) => boolean>(() => false);
  const hostIdRef = useRef<string | null>(null);
  const hostRef = useRef(isHost);
  const phaseRef = useRef<Phase>(phase);
  const tierRef = useRef<Tier>(tier);
  const mirroredRef = useRef(mirrored);
  const filterRef = useRef(filter);
  const layoutRef = useRef(layout);
  const frameIdRef = useRef(frameId);
  const limitsRef = useRef(limits);
  const backdropRef = useRef(backdrop);
  const shutterRef = useRef(shutter);
  const participantsRef = useRef<Array<{ peerId: string; name: string; isHost: boolean }>>([]);
  const reviewRef = useRef<Array<{ shotIndex: number; url: string }>>([]);
  const captureTickRef = useRef<(index: number, isRetake: boolean) => Promise<void>>(async () => undefined);
  const timerHandlerRef = useRef<(message: Extract<SignalMessage, { t: "timer" }>) => void>(() => undefined);
  const busyRef = useRef(false);

  hostRef.current = isHost;
  phaseRef.current = phase;
  tierRef.current = tier;
  mirroredRef.current = mirrored;
  filterRef.current = filter;
  layoutRef.current = layout;
  frameIdRef.current = frameId;
  limitsRef.current = limits;
  backdropRef.current = backdrop;
  shutterRef.current = shutter;
  busyRef.current = busy !== null;
  reviewRef.current = review;

  const captureEdge = tier === "paid" ? 2048 : 1440;

  // ------------------------------------------------------------------- storage
  const storeShot = useCallback(
    (index: number, participantId: string, captured: Captured) => {
      const existing = shotsRef.current.get(index) ?? new Map<string, Captured>();
      existing.set(participantId, captured);
      shotsRef.current.set(index, existing);
      setFilled([...shotsRef.current.values()].filter((bucket) => bucket.size > 0).length);

      void putRawShot({
        key: `${code}:${index}:${participantId}`,
        roomCode: code,
        shotIndex: index,
        participantId,
        blob: captured.blob,
        width: captured.width,
        height: captured.height,
        savedAt: Date.now(),
      }).catch(() => undefined);

      const waiter = waitersRef.current.get(index);
      if (waiter && expectedRef.current.length > 0 && expectedRef.current.every((id) => existing.has(id))) {
        waitersRef.current.delete(index);
        waiter();
      }
    },
    [code],
  );

  const markReady = useCallback((peerId: string) => {
    setReadyPeers((previous) => (previous.includes(peerId) ? previous : [...previous, peerId]));
  }, []);

  // -------------------------------------------------------------- data channel
  const handleData = useCallback(
    (peerId: string, data: ArrayBuffer | string) => {
      if (typeof data === "string") {
        const message = parseDataText(data);
        if (!message) return;
        if (message.t === "ping") {
          sendToRef.current(
            peerId,
            encodeDataText({ t: "pong", id: message.id, sentAt: message.sentAt, receivedAt: Date.now() }),
          );
          return;
        }
        if (message.t === "pong") {
          const sample = resolvePong(pendingPingsRef.current, message.id, message.receivedAt);
          if (!sample) return;
          pendingPingsRef.current = pendingPingsRef.current.filter((item) => item.id !== message.id);
          const next = applySample(clockRef.current, sample);
          clockRef.current = next;
          setClock(next);
          return;
        }
        if (message.t === "ready") markReady(peerId);
        return;
      }

      const result = assemblerRef.current.push(data);
      if (!result.done) return;
      const transfer = result.blob;
      storeShot(transfer.shotIndex, transfer.participantId, {
        blob: assemblerRef.current.assemble(transfer),
        width: transfer.width,
        height: transfer.height,
      });
    },
    [markReady, storeShot],
  );

  const onPeerOpen = useCallback(
    (peerId: string) => {
      if (!hostRef.current) {
        sendToRef.current(peerId, encodeDataText({ t: "ping", id: uid(), sentAt: Date.now() }));
      }
      if (hostRef.current && phaseRef.current === "booth") {
        send({ t: "status", status: "active" });
      }
    },
    [send],
  );

  const onPeerClosed = useCallback((peerId: string) => {
    setReadyPeers((previous) => previous.filter((id) => id !== peerId));
  }, []);

  const webrtc = useWebRTC({
    roomCode: code,
    selfId: identity.id,
    selfName,
    isHost,
    localStream: media.stream,
    sendSignal: send,
    subscribe,
    maxParticipants: room?.maxParticipants ?? 2,
    onDataMessage: handleData,
    onPeerOpen,
    onPeerClosed,
  });

  sendToRef.current = webrtc.sendTo;
  hostIdRef.current = isHost ? identity.id : webrtc.hostId;

  // --------------------------------------------------------------- participants
  const participants = useMemo(() => {
    const all = [
      { peerId: identity.id, name: selfName, isHost, mirrored, joinedAt: identity.joinedAt },
      ...webrtc.peers.map((peer) => peer.info),
    ];
    return all
      .slice()
      .sort((a, b) => a.joinedAt - b.joinedAt || a.peerId.localeCompare(b.peerId))
      .map(({ peerId, name, isHost: peerHost }) => ({ peerId, name, isHost: peerHost }));
  }, [identity.id, identity.joinedAt, isHost, mirrored, selfName, webrtc.peers]);

  participantsRef.current = participants;

  const lobbyParticipants: LobbyParticipant[] = participants.map((participant) => ({
    peerId: participant.peerId,
    name: participant.name,
    isHost: participant.isHost,
    ready: participant.peerId === identity.id ? selfReady : readyPeers.includes(participant.peerId),
    self: participant.peerId === identity.id,
  }));

  const stageSources: StageSource[] = useMemo(() => {
    return participants.map((participant) => {
      if (participant.peerId === identity.id) {
        return { id: "self", stream: media.stream, mirrored };
      }
      const peer = webrtc.peers.find((item) => item.info.peerId === participant.peerId);
      return { id: participant.peerId, stream: peer?.stream ?? null, mirrored: peer?.info.mirrored ?? false };
    });
  }, [identity.id, media.stream, mirrored, participants, webrtc.peers]);

  const selfFeed = useCallback((): CellFeed | null => {
    const video = localVideoRef.current;
    const current = backdropRef.current;
    const canvas = backdropCanvasRef.current;
    if (current.enabled && current.ready && canvas && video && video.videoWidth > 0) {
      if (current.render(video, canvas, { mirrored: mirroredRef.current })) {
        return { image: canvas, width: canvas.width, height: canvas.height, mirrored: false };
      }
    }
    if (video && video.videoWidth > 0) {
      return { image: video, width: video.videoWidth, height: video.videoHeight, mirrored: mirroredRef.current };
    }
    return null;
  }, []);

  const handleCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    stageCanvasRef.current = canvas;
  }, []);

  // ------------------------------------------------------------------ backdrop
  useEffect(() => {
    if (backdropCanvasRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 720;
    backdropCanvasRef.current = canvas;
  }, []);

  // -------------------------------------------------------------- local <video>
  /**
   * The capture element lives outside the conditional phase tree, but it is
   * still mounted after the room skeleton disappears. A plain effect keyed on
   * `media.stream` can therefore run while the ref is still null and never
   * retry, so a callback ref attaches the stream the moment it mounts.
   */
  const streamRef = useRef<MediaStream | null>(null);
  streamRef.current = media.stream;

  const attachLocalVideo = useCallback((element: HTMLVideoElement | null) => {
    localVideoRef.current = element;
    if (!element) return;
    if (element.srcObject !== streamRef.current) element.srcObject = streamRef.current;
    void element.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;
    if (video.srcObject !== media.stream) video.srcObject = media.stream;
    void video.play().catch(() => undefined);
  }, [media.stream]);

  // ------------------------------------------------------------- boomerang ring
  const boomerangRef = useRef<ImageBitmap[]>([]);
  const boomerangActiveRef = useRef(false);
  const boomerangCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (phase !== "booth") return;
    let raf = 0;
    let last = 0;
    let inflight = false;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!boomerangActiveRef.current || tierRef.current !== "paid") return;
      if (now - last < 1000 / 12 || inflight) return;
      const stage = stageCanvasRef.current;
      if (!stage || !stage.width) return;
      last = now;

      if (!boomerangCanvasRef.current) boomerangCanvasRef.current = document.createElement("canvas");
      const canvas = boomerangCanvasRef.current;
      const scale = Math.min(1, 540 / Math.max(stage.width, stage.height));
      const width = Math.max(1, Math.round(stage.width * scale));
      const height = Math.max(1, Math.round(stage.height * scale));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(stage, 0, 0, width, height);

      inflight = true;
      void createImageBitmap(canvas)
        .then((bitmap) => {
          inflight = false;
          if (!boomerangActiveRef.current) {
            bitmap.close();
            return;
          }
          boomerangRef.current.push(bitmap);
          while (boomerangRef.current.length > 18) boomerangRef.current.shift()?.close();
        })
        .catch(() => {
          inflight = false;
        });
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    return () => {
      for (const bitmap of boomerangRef.current) bitmap.close();
      boomerangRef.current = [];
    };
  }, []);

  const stopBoomerang = useCallback((): ImageBitmap[] | null => {
    boomerangActiveRef.current = false;
    const frames = boomerangRef.current;
    boomerangRef.current = [];
    if (frames.length < 6) {
      for (const frame of frames) frame.close();
      return null;
    }
    return frames;
  }, []);

  // ---------------------------------------------------------------- clock sync
  useEffect(() => {
    if (isHost) return;
    const timer = window.setInterval(() => {
      const host = hostIdRef.current;
      if (!host) return;
      const id = uid();
      pendingPingsRef.current.push({ id, sentAt: Date.now() });
      sendToRef.current(host, encodeDataText({ t: "ping", id, sentAt: Date.now() }));
      if (pendingPingsRef.current.length > 8) pendingPingsRef.current.shift();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [isHost]);

  // ------------------------------------------------------------------ signals
  const timerHandler = useCallback(
    (message: Extract<SignalMessage, { t: "timer" }>) => {
      if (hostRef.current) return;
      const localTarget = hostToLocal(message.targetHostTs, clockRef.current);
      const remaining = Math.max(0, localTarget - Date.now());
      countdown.start(remaining, () => undefined, {
        shotIndex: message.shotIndex,
        isRetake: message.isRetake,
      });
      scheduleAt(localTarget, () => {
        void captureTickRef.current(message.shotIndex, message.isRetake);
      });
      setShotIndex(message.shotIndex);
      if (message.shotIndex >= LAYOUT_SHOTS[layoutRef.current] - 1) setAwaitingResult(true);
    },
    [countdown],
  );
  timerHandlerRef.current = timerHandler;

  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      switch (message.t) {
        case "timer":
          timerHandlerRef.current(message);
          break;
        case "frame": {
          const next = FRAMES.find((item) => item.id === message.frameId);
          if (next) setFrameId(next.id);
          setLayout(message.layout);
          if (filterAvailable(message.filter, tierRef.current)) setFilter(message.filter);
          break;
        }
        case "tier": {
          setRoom((previous) =>
            previous
              ? {
                  ...previous,
                  tier: message.tier,
                  maxParticipants: message.maxParticipants,
                  maxRetakes: message.maxRetakes,
                  expiresAt: message.expiresAt,
                }
              : previous,
          );
          break;
        }
        case "status": {
          if (message.status === "active") setPhase((current) => (current === "result" ? current : "booth"));
          break;
        }
        case "result": {
          setOutput({
            token: message.token,
            imageUrl: message.imageUrl,
            videoUrl: message.videoUrl,
            expiresAt: message.expiresAt,
          });
          setShareUrl(message.shareUrl);
          setPhase("result");
          setAwaitingResult(false);
          break;
        }
        case "full": {
          setToast("Ruangan sudah penuh. Buka Session Pass untuk menerima hingga 4 peserta.");
          break;
        }
        default:
          break;
      }
    });
    return unsubscribe;
  }, [subscribe]);

  // --------------------------------------------------------------- frame wiring
  const broadcastFrame = useCallback(
    (nextFrameId: string, nextLayout: LayoutType, nextFilter: FilterId) => {
      send({ t: "frame", frameId: nextFrameId, layout: nextLayout, filter: nextFilter });
      void fetch("/api/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, action: "frame", frameId: nextFrameId, layout: nextLayout }),
      }).catch(() => undefined);
    },
    [code, send],
  );

  const chooseFrame = useCallback(
    (nextFrameId: string) => {
      const next = FRAMES.find((item) => item.id === nextFrameId);
      if (!next) return;
      if (next.isPremium && tierRef.current === "free") {
        setPaywallOpen(true);
        return;
      }
      setFrameId(next.id);
      setLayout(next.layout);
      broadcastFrame(next.id, next.layout, filterRef.current);
    },
    [broadcastFrame],
  );

  const chooseLayout = useCallback(
    (nextLayout: LayoutType) => {
      setLayout(nextLayout);
      const current = getFrame(frameIdRef.current);
      const candidate = current.layout === nextLayout ? current : defaultFrameForLayout(nextLayout, tierRef.current);
      const next =
        candidate.isPremium && tierRef.current === "free" ? defaultFrameForLayout(nextLayout, "free") : candidate;
      setFrameId(next.id);
      broadcastFrame(next.id, nextLayout, filterRef.current);
    },
    [broadcastFrame],
  );

  const chooseFilter = useCallback(
    (nextFilter: FilterId) => {
      if (!filterAvailable(nextFilter, tierRef.current)) {
        setPaywallOpen(true);
        return;
      }
      setFilter(nextFilter);
      broadcastFrame(frameIdRef.current, layoutRef.current, nextFilter);
    },
    [broadcastFrame],
  );

  // ------------------------------------------------------------------- capture
  const captureTick = useCallback(
    async (index: number) => {
      shutterRef.current.trigger();
      try {
        const video = localVideoRef.current;
        const currentBackdrop = backdropRef.current;
        const backdropCanvas = backdropCanvasRef.current;
        let captured: CapturedFrame | null = null;

        // A participant may join seconds before the shutter, or the tab may
        // have just been re-shown. Give the camera a short grace period for its
        // first decoded frame instead of dropping the slot immediately.
        if (video && video.videoWidth === 0) {
          await new Promise<void>((resolve) => {
            const startedAt = Date.now();
            const poll = () => {
              if (!video || video.videoWidth > 0 || Date.now() - startedAt > 1200) resolve();
              else window.setTimeout(poll, 80);
            };
            poll();
          });
        }

        if (
          currentBackdrop.enabled &&
          currentBackdrop.ready &&
          backdropCanvas &&
          backdropCanvas.width > 1 &&
          video &&
          video.videoWidth > 0
        ) {
          captured = await captureSource(backdropCanvas, backdropCanvas.width, backdropCanvas.height, {
            mirrored: false,
            maxEdge: captureEdge,
          });
        } else if (video && video.videoWidth > 0) {
          captured = await captureFrame(video, { mirrored: mirroredRef.current, maxEdge: captureEdge });
        }

        if (!captured) {
          setToast("Kamera belum menghasilkan frame. Cek izin lalu pilih kamera lain.");
          return;
        }

        if (hostRef.current) {
          storeShot(index, identity.id, captured);
          return;
        }

        const host = hostIdRef.current;
        if (!host) {
          setToast("Host belum terhubung, jepretan tidak terkirim.");
          return;
        }
        const buffer = await bufferFromBlob(captured.blob);
        const packets = splitChunks(
          captured.blob,
          {
            id: `${identity.id}-${index}-${Date.now()}`,
            shotIndex: index,
            participantId: identity.id,
            width: captured.width,
            height: captured.height,
          },
          buffer,
        );
        for (const packet of packets) sendToRef.current(host, packet);
        sendToRef.current(host, encodeDataText({ t: "shot-done", shotIndex: index }));
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Gagal menangkap jepretan.");
      }
    },
    [captureEdge, identity.id, storeShot],
  );
  captureTickRef.current = captureTick;

  const runShot = useCallback(
    async (index: number, isRetake: boolean) => {
      shotsRef.current.set(index, new Map());
      const target = Date.now() + COUNTDOWN_MS;
      send({ t: "timer", shotIndex: index, targetHostTs: target, countdownMs: COUNTDOWN_MS, isRetake });
      countdown.start(COUNTDOWN_MS, () => undefined, { shotIndex: index, isRetake });
      scheduleAt(target, () => {
        void captureTickRef.current(index, isRetake);
      });
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(() => {
          waitersRef.current.delete(index);
          resolve();
        }, COUNTDOWN_MS + SHOT_TIMEOUT_MS);
        waitersRef.current.set(index, () => {
          window.clearTimeout(timer);
          resolve();
        });
      });
    },
    [countdown, send],
  );

  const buildReview = useCallback(() => {
    const shotCount = LAYOUT_SHOTS[layoutRef.current];
    const entries: Array<{ shotIndex: number; url: string }> = [];
    for (let index = 0; index < shotCount; index += 1) {
      const bucket = shotsRef.current.get(index);
      const own = bucket?.get(identity.id) ?? bucket?.values().next().value;
      if (!own) continue;
      entries.push({ shotIndex: index, url: URL.createObjectURL(own.blob) });
    }
    setReview((previous) => {
      for (const item of previous) URL.revokeObjectURL(item.url);
      return entries;
    });
  }, [identity.id]);

  const finalize = useCallback(
    async (boomerangFrames: ImageBitmap[] | null) => {
      try {
        setBusy("compose");
        const shotCount = LAYOUT_SHOTS[layoutRef.current];
        const order =
          expectedRef.current.length > 0 ? expectedRef.current : participantsRef.current.map((item) => item.peerId);
        const shots: Array<Record<string, { blob: Blob; width: number; height: number }>> = [];
        for (let index = 0; index < shotCount; index += 1) {
          const bucket = shotsRef.current.get(index);
          const record: Record<string, { blob: Blob; width: number; height: number }> = {};
          if (bucket) {
            for (const [peerId, captured] of bucket) {
              record[peerId] = { blob: captured.blob, width: captured.width, height: captured.height };
            }
          }
          shots.push(record);
        }

        const labels: Record<string, string> = {};
        for (const participant of participantsRef.current) labels[participant.peerId] = participant.name;

        const image = await worker.compose({
          layout: layoutRef.current,
          tier: tierRef.current,
          frame: getFrame(frameIdRef.current),
          filter: filterRef.current,
          participantIds: order,
          participantLabels: labels,
          shots,
          watermark: limitsRef.current.watermark,
          roomCode: code,
          dateStamp: formatDateStamp(),
          longEdge: exportLongEdge(tierRef.current, order.length),
        });

        let video: Blob | null = null;
        if (tierRef.current === "paid" && boomerangFrames && boomerangFrames.length >= 6) {
          try {
            video = await worker.encodeVideo(boomerangFrames, 12, true);
          } catch (error) {
            setToast(
              error instanceof Error && /WebCodecs|H\.264/i.test(error.message)
                ? "Boomerang dilewati: peramban ini tidak mendukung WebCodecs H.264."
                : "Boomerang gagal dikodekan, foto tetap tersimpan.",
            );
          }
        }

        setBusy("upload");
        const form = new FormData();
        form.append("code", code);
        form.append("image", new File([image], `photobooth-${code}.png`, { type: "image/png" }));
        if (video) form.append("video", new File([video], `photobooth-${code}.mp4`, { type: "video/mp4" }));

        const response = await fetch("/api/output", { method: "POST", body: form });
        const payload = (await response.json().catch(() => ({}))) as {
          token?: string;
          imageUrl?: string;
          videoUrl?: string | null;
          expiresAt?: string;
          error?: string;
        };
        if (!response.ok || !payload.token || !payload.imageUrl || !payload.expiresAt) {
          throw new Error(payload.error ?? "Gagal mengunggah hasil.");
        }

        const share = `${window.location.origin}/share/${payload.token}`;
        const nextOutput: ShareOutput = {
          token: payload.token,
          imageUrl: payload.imageUrl,
          videoUrl: payload.videoUrl ?? null,
          expiresAt: payload.expiresAt,
        };
        setOutput(nextOutput);
        setShareUrl(share);
        setPhase("result");
        send({
          t: "result",
          token: nextOutput.token,
          shareUrl: share,
          imageUrl: nextOutput.imageUrl,
          videoUrl: nextOutput.videoUrl,
          expiresAt: nextOutput.expiresAt,
        });
        void fetch("/api/rooms", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, action: "complete" }),
        }).catch(() => undefined);
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Gagal menyusun hasil.");
      } finally {
        setBusy(null);
      }
    },
    [code, send, worker],
  );

  /** Runs every slot, then composes + uploads. Host only. */
  const runAll = useCallback(
    async () => {
      if (!hostRef.current || busyRef.current) return;
      const shotCount = LAYOUT_SHOTS[layoutRef.current];
      const order = participantsRef.current.map((participant) => participant.peerId);
      if (order.length > 0) expectedRef.current = order;
      setBusy("capture");
      setAwaitingResult(false);
      setReview((previous) => {
        for (const item of previous) URL.revokeObjectURL(item.url);
        return [];
      });
      boomerangActiveRef.current = tierRef.current === "paid";

      for (let index = 0; index < shotCount; index += 1) {
        setShotIndex(index);
        await runShot(index, false);
      }

      const frames = stopBoomerang();
      if (tierRef.current === "paid" && (!frames || frames.length < 6)) {
        setToast("Boomerang tidak terekam karena tab tidak aktif. Biarkan tab ini tetap terlihat saat memotret.");
      }
      buildReview();
      setBusy(null);
      await finalize(frames);
    },
    [buildReview, finalize, runShot, stopBoomerang],
  );

  const retakeShot = useCallback(
    async (index: number) => {
      if (!hostRef.current || busyRef.current) return;
      if (room && room.retakesUsed >= room.maxRetakes) {
        setToast("Kuota retake habis. Buka Session Pass untuk retake tanpa batas.");
        setPaywallOpen(true);
        return;
      }
      setBusy("capture");
      setReview((previous) => {
        for (const item of previous) URL.revokeObjectURL(item.url);
        return [];
      });
      if (room) {
        const response = await fetch("/api/rooms", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, action: "retake" }),
        });
        if (response.ok) {
          const payload = (await response.json()) as { room: PublicRoom };
          setRoom(payload.room);
        }
      }
      expectedRef.current = participantsRef.current.map((participant) => participant.peerId);
      boomerangActiveRef.current = false;
      await runShot(index, true);
      buildReview();
      setBusy(null);
      await finalize(null);
    },
    [buildReview, code, finalize, room, runShot],
  );

  /**
   * "Ulangi jepretan" from the result screen re-runs every slot. It has to
   * consume the same retake quota as the per-slot retake button, otherwise the
   * free tier could reshoot indefinitely from the result panel.
   */
  const retakeSession = useCallback(async () => {
    if (!hostRef.current || busyRef.current) return;
    if (room && room.retakesUsed >= room.maxRetakes) {
      setToast("Kuota retake habis. Buka Session Pass untuk retake tanpa batas.");
      setPaywallOpen(true);
      return;
    }
    if (room) {
      const response = await fetch("/api/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, action: "retake" }),
      });
      if (response.ok) {
        const payload = (await response.json()) as { room: PublicRoom };
        setRoom(payload.room);
      }
    }
    setOutput(null);
    setPhase("booth");
    await runAll();
  }, [code, room, runAll]);

  // --------------------------------------------------------------- transitions
  const enterBooth = useCallback(() => {
    if (!isHost) {
      setSelfReady(true);
      markReady(identity.id);
      const host = hostIdRef.current;
      if (host) sendToRef.current(host, encodeDataText({ t: "ready", at: Date.now() }));
      return;
    }
    setPhase("booth");
    send({ t: "status", status: "active" });
    setReadyPeers((previous) => [...new Set([...previous, identity.id])]);
  }, [identity.id, isHost, markReady, send]);

  const leave = useCallback(() => {
    media.stop();
    router.push("/");
  }, [media, router]);

  const onUnlocked = useCallback(() => {
    void loadRoom().then((next) => {
      if (!next) return;
      send({
        t: "tier",
        tier: next.tier,
        maxParticipants: next.maxParticipants,
        maxRetakes: next.maxRetakes,
        expiresAt: next.expiresAt,
      });
      setPaywallOpen(false);
    });
  }, [loadRoom, send]);

  const switchCamera = useCallback(
    async (deviceId: string) => {
      const track = await media.switchCamera(deviceId);
      if (track) await webrtc.replaceVideoTrack(track);
    },
    [media, webrtc],
  );

  const toggleCamera = useCallback(() => {
    const track = media.stream?.getVideoTracks()[0];
    if (!track) {
      void media.request({ withAudio: micOn });
      setCameraOn(true);
      return;
    }
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
  }, [media, micOn]);

  const toggleMic = useCallback(() => {
    const track = media.stream?.getAudioTracks()[0];
    if (!track) {
      void media.request({ withAudio: true });
      setMicOn(true);
      return;
    }
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, [media]);

  const applyUvcControls = useCallback(
    async (next: UvcState) => {
      setUvc(next);
      const track = media.stream?.getVideoTracks()[0];
      if (track) await applyUvc(track, next);
    },
    [media.stream],
  );

  const changeName = useCallback(
    (value: string) => {
      const clean = value.slice(0, 18);
      setSelfName(clean);
      window.sessionStorage.setItem("pb:name", clean);
      webrtc.setSelfName(clean);
    },
    [webrtc],
  );

  const toggleMirror = useCallback(() => {
    const value = !mirroredRef.current;
    setMirrored(value);
    send({ t: "mirror", peerId: identity.id, mirrored: value });
  }, [identity.id, send]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      for (const item of reviewRef.current) URL.revokeObjectURL(item.url);
    };
  }, []);

  // ---------------------------------------------------------------------- views
  if (loadingRoom) return <BoothSkeleton code={code} />;

  if (roomError || !room) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 px-5 text-center">
        <CircleAlert className="h-6 w-6 text-amber-300" />
        <h1 className="text-xl font-semibold">Tidak bisa membuka ruangan</h1>
        <p className="text-sm text-white/50">{roomError ?? "Ruangan tidak ditemukan."}</p>
        <div className="flex gap-2">
          <Link href="/join">
            <Button variant="secondary">Coba kode lain</Button>
          </Link>
          <Link href="/create">
            <Button>Buat ruang baru</Button>
          </Link>
        </div>
      </div>
    );
  }

  const shotCount = LAYOUT_SHOTS[layout];
  const busyLabel =
    busy === "capture"
      ? `Jepretan ${Math.min(shotIndex + 1, shotCount)} dari ${shotCount}`
      : busy === "compose"
        ? "Menyusun komposit di perangkat…"
        : busy === "upload"
          ? "Mengunggah hasil…"
          : null;

  return (
    <div className="min-h-dvh">
      <video ref={attachLocalVideo} autoPlay playsInline muted className="pointer-events-none fixed h-px w-px opacity-0" />

      <TopBar code={code} tier={tier} remaining={session.remaining} signalMode={signalMode} onLeave={leave} />

      {phase === "lobby" ? (
        <LobbyPanel
          room={room}
          code={code}
          shareUrl={`${window.location.origin}/room/${code}`}
          isHost={isHost}
          participants={lobbyParticipants}
          selfName={selfName}
          onName={changeName}
          mirrored={mirrored}
          onMirror={(value) => {
            setMirrored(value);
            send({ t: "mirror", peerId: identity.id, mirrored: value });
          }}
          stream={media.stream}
          cameraOn={cameraOn && Boolean(media.stream)}
          micOn={micOn}
          onToggleCamera={toggleCamera}
          onToggleMic={toggleMic}
          mediaError={media.error}
          requesting={media.permission === "requesting"}
          onRetryMedia={() => void media.request({ withAudio: true })}
          device={{
            cameras: media.devices.cameras,
            microphones: media.devices.microphones,
            cameraId: media.cameraId,
            microphoneId: media.microphoneId,
            resolution: media.resolution,
            onCamera: (deviceId) => void switchCamera(deviceId),
            onMicrophone: (deviceId) => void media.switchMicrophone(deviceId),
            onRefresh: () => void media.refreshDevices(),
          }}
          uvc={{
            enabled: media.supportsUvcControls,
            values: { zoom: uvc.zoom ?? 100, exposure: uvc.exposure ?? 120, whiteBalance: uvc.whiteBalance ?? 5200 },
            onChange: (values) => void applyUvcControls(values),
            locked: tier === "free",
            onUnlock: () => setPaywallOpen(true),
          }}
          backdrop={{
            presets: backdrop.presets,
            presetId: backdrop.presetId,
            enabled: backdrop.enabled,
            ready: backdrop.ready,
            loading: backdrop.loading,
            error: backdrop.error,
            locked: tier === "free",
            onToggle: (value) => backdrop.setEnabled(value),
            onPreset: (id) => backdrop.setPresetId(id),
            onUnlock: () => setPaywallOpen(true),
          }}
          remainingMs={session.remaining}
          expired={session.expired}
          onUnlock={() => setPaywallOpen(true)}
          onReady={enterBooth}
          ready={selfReady}
          waitingForHost={!isHost && selfReady}
        />
      ) : phase === "result" && output ? (
        <ResultPanel
          output={output}
          shareUrl={shareUrl}
          roomCode={code}
          isHost={isHost}
          retakeLabel={session.retakeLabel}
          canRetake={isHost}
          onRetake={() => {
            void retakeSession();
          }}
          onNewSession={() => {
            setOutput(null);
            setReview((previous) => {
              for (const item of previous) URL.revokeObjectURL(item.url);
              return [];
            });
            shotsRef.current.clear();
            setFilled(0);
            setSelfReady(false);
            setPhase("lobby");
            void loadRoom();
            send({ t: "status", status: "waiting" });
          }}
          busy={busy !== null}
        />
      ) : (
        <>
          <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-28 pt-2 sm:px-6 lg:grid-cols-[1fr_360px] lg:pb-8">
            <div className="relative flex min-h-[52vh] items-center justify-center lg:sticky lg:top-4 lg:h-[calc(100dvh-7rem)] lg:min-h-0 lg:self-start">
              <div className="absolute inset-0 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_50%_30%,rgba(226,82,58,0.16),transparent_60%)] blur-2xl" />

              <StagePreview
                sources={stageSources}
                frame={frame}
                layout={layout}
                participantCount={participants.length}
                tier={tier}
                watermark={limits.watermark}
                roomCode={code}
                dateStamp={formatDateStamp()}
                selfFeed={selfFeed}
                onCanvas={handleCanvas}
                className="max-h-[74vh] w-full"
              />

              {countdown.running && countdown.value !== null ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span
                    key={countdown.value}
                    className="animate-countdown font-display text-[26vw] leading-none text-white drop-shadow-[0_10px_40px_rgba(0,0,0,0.7)] sm:text-[14rem]"
                  >
                    {countdown.value}
                  </span>
                </div>
              ) : null}

              {busyLabel || awaitingResult ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-4">
                  <div className="surface-strong inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-xs text-white/75">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-flame" />
                    {busyLabel ?? "Menunggu host menyusun hasil…"}
                  </div>
                </div>
              ) : null}

              {session.expired ? (
                <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/70 text-center backdrop-blur-sm">
                  <div className="px-6">
                    <Timer className="mx-auto h-6 w-6 text-amber-300" />
                    <h2 className="mt-3 text-lg font-medium">Waktu sesi habis</h2>
                    <p className="mt-1 max-w-xs text-sm text-white/50">
                      Hasil yang sudah diunduh tetap milikmu. Buat ruang baru untuk sesi berikutnya.
                    </p>
                    <Link href="/create" className="mt-4 inline-block">
                      <Button size="sm">Buat ruang baru</Button>
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="space-y-4">
              <div className="surface rounded-3xl p-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-sm font-medium">
                    <Users className="h-4 w-4 text-white/45" /> Peserta ({participants.length}/{room.maxParticipants})
                  </h2>
                  <span className={cn("text-[11px]", clock.samples > 0 ? "text-[#7ee2c8]" : "text-white/30")}>
                    {clock.samples > 0
                      ? `sync ${Math.round(clock.rtt / 2)} ms`
                      : isHost
                        ? "sumber waktu"
                        : "sync —"}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {participants.map((participant) => (
                    <li key={participant.peerId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#7ee2c8]" />
                        <span className="truncate text-white/75">
                          {participant.name}
                          {participant.peerId === identity.id ? " (kamu)" : ""}
                        </span>
                      </span>
                      {participant.isHost ? (
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-white/30">host</span>
                      ) : null}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={toggleMirror}
                    aria-pressed={mirrored}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition",
                      mirrored
                        ? "border-flame/50 bg-flame/15 text-white"
                        : "border-white/12 bg-black/25 text-white/60 hover:border-white/30",
                    )}
                  >
                    <FlipHorizontal2 className="h-3.5 w-3.5" /> Mirror
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolOpen((value) => !value)}
                    aria-pressed={toolOpen}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition",
                      toolOpen
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-white/12 bg-black/25 text-white/60 hover:border-white/30",
                    )}
                  >
                    <Camera className="h-3.5 w-3.5" /> Kamera
                  </button>
                </div>

                {toolOpen ? (
                  <div className="mt-3 space-y-3 border-t border-white/8 pt-3">
                    <DevicePicker
                      cameras={media.devices.cameras}
                      microphones={media.devices.microphones}
                      cameraId={media.cameraId}
                      microphoneId={media.microphoneId}
                      resolution={media.resolution}
                      onCamera={(deviceId) => void switchCamera(deviceId)}
                      onMicrophone={(deviceId) => void media.switchMicrophone(deviceId)}
                      onRefresh={() => void media.refreshDevices()}
                    />
                    <UvcPanel
                      enabled={media.supportsUvcControls}
                      values={{
                        zoom: uvc.zoom ?? 100,
                        exposure: uvc.exposure ?? 120,
                        whiteBalance: uvc.whiteBalance ?? 5200,
                      }}
                      onChange={(values) => void applyUvcControls(values)}
                      locked={tier === "free"}
                      onUnlock={() => setPaywallOpen(true)}
                    />
                  </div>
                ) : null}
              </div>

              <div className="surface rounded-3xl p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-sm font-medium">
                    <Layers className="h-4 w-4 text-white/45" /> Bingkai & filter
                  </h2>
                  {tier === "free" ? (
                    <button
                      type="button"
                      onClick={() => setPaywallOpen(true)}
                      className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#f6d9a8] hover:underline"
                    >
                      <Crown className="h-2.5 w-2.5" /> Pass
                    </button>
                  ) : null}
                </div>
                <FramePicker
                  tier={tier}
                  layout={layout}
                  frameId={frameId}
                  filter={filter}
                  participantCount={participants.length}
                  onLayout={chooseLayout}
                  onFrame={chooseFrame}
                  onFilter={chooseFilter}
                  onUnlock={() => setPaywallOpen(true)}
                />
              </div>

              <div className="surface rounded-3xl p-4">
                <BackdropPicker
                  presets={backdrop.presets}
                  presetId={backdrop.presetId}
                  enabled={backdrop.enabled}
                  ready={backdrop.ready}
                  loading={backdrop.loading}
                  error={backdrop.error}
                  locked={tier === "free"}
                  onToggle={(value) => backdrop.setEnabled(value)}
                  onPreset={(id) => backdrop.setPresetId(id)}
                  onUnlock={() => setPaywallOpen(true)}
                />
              </div>
            </aside>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0c0b0a]/92 px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
              <div className="hidden min-w-0 flex-1 sm:block">
                <div className="flex items-center justify-between text-[11px] text-white/40">
                  <span>
                    {filled}/{shotCount} slot terisi
                  </span>
                  <span>
                    retake {session.retakeLabel} · {limits.watermark ? "watermark aktif" : "tanpa watermark"}
                  </span>
                </div>
                <Progress value={(filled / shotCount) * 100} className="mt-2" />
              </div>

              {isHost ? (
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={busy !== null || !media.stream || session.expired}
                  onClick={() => void runAll()}
                >
                  <Aperture className="h-4.5 w-4.5" />
                  {busy ? "Memproses…" : review.length > 0 ? "Jepret ulang semua" : "Mulai jepret"}
                </Button>
              ) : (
                <div className="flex w-full items-center justify-center gap-2 text-xs text-white/45 sm:w-auto">
                  <Wifi className="h-3.5 w-3.5" /> Menunggu host memulai jepretan
                </div>
              )}
            </div>
          </div>

          {isHost && review.length > 0 && busy === null && !session.expired ? (
            <div className="fixed inset-x-0 bottom-16 z-10 px-4 sm:bottom-20">
              <div className="surface-strong mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
                  {review.map((item) => (
                    <div key={item.shotIndex} className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={`Jepretan ${item.shotIndex + 1}`}
                        className="h-16 w-12 rounded-lg object-cover ring-1 ring-white/15"
                      />
                      <button
                        type="button"
                        onClick={() => void retakeShot(item.shotIndex)}
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-flame text-white shadow"
                        aria-label={`Ulangi jepretan ${item.shotIndex + 1}`}
                      >
                        <RefreshCw className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void retakeShot(review[review.length - 1]?.shotIndex ?? 0)}
                  disabled={busy !== null}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retake {session.retakeLabel}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <PaywallModal open={paywallOpen} code={code} onClose={() => setPaywallOpen(false)} onUnlocked={onUnlocked} />
      <Toast message={toast} />

      {signalStatus === "error" ? (
        <div className="fixed left-4 top-16 z-30 inline-flex items-center gap-2 rounded-full bg-[#c8372a] px-3 py-1.5 text-[11px] text-white">
          <WifiOff className="h-3 w-3" /> Sinyal terputus, mencoba ulang…
        </div>
      ) : null}
    </div>
  );
}

function TopBar({
  code,
  tier,
  remaining,
  signalMode,
  onLeave,
}: {
  code: string;
  tier: Tier;
  remaining: number;
  signalMode: "supabase" | "broadcast-channel";
  onLeave?: () => void;
}) {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Beranda">
          <Logo compact />
        </Link>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded-lg border border-white/12 bg-white/5 px-2.5 py-1 font-mono text-xs tracking-[0.24em] text-white/70">
            {normalizeRoomCode(code)}
          </span>
          {tier === "paid" ? (
            <Pill tone="pro">
              <Crown className="h-2.5 w-2.5" /> Pass
            </Pill>
          ) : (
            <Pill>Free</Pill>
          )}
          {signalMode === "broadcast-channel" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber-200">
              <Wifi className="h-2.5 w-2.5" /> demo lokal
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-white/45">
          <Timer className="h-3.5 w-3.5" />
          <span className={cn("font-mono", remaining < 60000 && "text-amber-300")}>{formatClock(remaining)}</span>
        </span>
        {onLeave ? (
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-[11px] text-white/55 transition hover:border-white/30 hover:text-white"
          >
            <LogOut className="h-3 w-3" /> Keluar
          </button>
        ) : null}
      </div>
    </header>
  );
}

function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[130] flex justify-center px-4">
      <div className="pointer-events-auto max-w-md rounded-2xl border border-white/12 bg-[#1b1917]/95 px-4 py-3 text-xs leading-relaxed text-white/80 shadow-2xl backdrop-blur">
        <span className="mr-1.5 inline-flex items-center gap-1 text-amber-300">
          <CircleAlert className="h-3 w-3" />
        </span>
        {message}
      </div>
    </div>
  );
}
