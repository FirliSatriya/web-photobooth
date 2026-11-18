"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface DeviceOption {
  deviceId: string;
  label: string;
}

export interface MediaState {
  stream: MediaStream | null;
  videoTrack: MediaStreamTrack | null;
  devices: { cameras: DeviceOption[]; microphones: DeviceOption[] };
  cameraId: string | null;
  microphoneId: string | null;
  error: string | null;
  permission: "idle" | "requesting" | "granted" | "denied";
  resolution: { width: number; height: number } | null;
  supportsUvcControls: boolean;
}

const IDEAL_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30 },
};

/** Progressive fallback so a cheap webcam never throws OverconstrainedError. */
const FALLBACK_CHAIN: MediaTrackConstraints[] = [
  IDEAL_CONSTRAINTS,
  { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
  { facingMode: "user" },
  true as unknown as MediaTrackConstraints,
];

function describe(error: unknown): string {
  if (!(error instanceof Error)) return "Tidak bisa mengakses kamera.";
  switch (error.name) {
    case "NotAllowedError":
      return "Izin kamera ditolak. Aktifkan izin kamera di pengaturan peramban lalu muat ulang.";
    case "NotFoundError":
      return "Tidak ada kamera yang terdeteksi pada perangkat ini.";
    case "NotReadableError":
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut dan coba lagi.";
    case "OverconstrainedError":
      return "Resolusi yang diminta tidak didukung kamera. Mencoba resolusi lain…";
    default:
      return error.message || "Gagal mengakses kamera.";
  }
}

export function useLocalMedia() {
  const [state, setState] = useState<MediaState>({
    stream: null,
    videoTrack: null,
    devices: { cameras: [], microphones: [] },
    cameraId: null,
    microphoneId: null,
    error: null,
    permission: "idle",
    resolution: null,
    supportsUvcControls: false,
  });
  const streamRef = useRef<MediaStream | null>(null);
  const replacingRef = useRef(false);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    const cameras = list
      .filter((device) => device.kind === "videoinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Kamera ${index + 1}`,
      }));
    const microphones = list
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Mikrofon ${index + 1}`,
      }));
    setState((previous) => ({ ...previous, devices: { cameras, microphones } }));
  }, []);

  const request = useCallback(
    async (options: { cameraId?: string | null; microphoneId?: string | null; withAudio?: boolean } = {}) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState((previous) => ({
          ...previous,
          error: "Peramban ini tidak mendukung akses kamera. Coba Chrome/Safari terbaru.",
        }));
        return null;
      }
      setState((previous) => ({ ...previous, permission: "requesting", error: null }));

      const videoConstraints = options.cameraId
        ? { ...IDEAL_CONSTRAINTS, deviceId: { exact: options.cameraId } }
        : IDEAL_CONSTRAINTS;
      const audioConstraints = options.withAudio === false
        ? false
        : options.microphoneId
          ? { deviceId: { exact: options.microphoneId } }
          : true;

      let stream: MediaStream | null = null;
      let lastError: unknown = null;

      for (const fallback of FALLBACK_CHAIN) {
        try {
          const video = typeof fallback === "boolean" ? true : { ...fallback, ...videoConstraints };
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: audioConstraints });
          break;
        } catch (error) {
          lastError = error;
          if (error instanceof Error && error.name === "NotAllowedError") break;
        }
      }

      if (!stream) {
        setState((previous) => ({ ...previous, permission: "denied", error: describe(lastError) }));
        return null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0] ?? null;
      const settings = videoTrack?.getSettings();

      setState((previous) => ({
        ...previous,
        stream,
        videoTrack,
        cameraId: settings?.deviceId ?? options.cameraId ?? previous.cameraId,
        microphoneId: options.microphoneId ?? previous.microphoneId,
        error: null,
        permission: "granted",
        resolution: settings?.width && settings?.height
          ? { width: settings.width, height: settings.height }
          : null,
        supportsUvcControls: detectUvc(videoTrack),
      }));
      await refreshDevices();
      return stream;
    },
    [refreshDevices],
  );

  /** Swaps camera without tearing down the peer connections (replaceTrack). */
  const switchCamera = useCallback(
    async (deviceId: string) => {
      if (!streamRef.current || replacingRef.current) return null;
      replacingRef.current = true;
      try {
        const constraints: MediaTrackConstraints = {
          ...IDEAL_CONSTRAINTS,
          deviceId: { exact: deviceId },
        };
        let next: MediaStreamTrack | null = null;
        try {
          next = (await navigator.mediaDevices.getUserMedia({ video: constraints })).getVideoTracks()[0] ?? null;
        } catch {
          next = (await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } }))
            .getVideoTracks()[0] ?? null;
        }
        if (!next) return null;

        const previousTrack = streamRef.current.getVideoTracks()[0] ?? null;
        if (previousTrack) {
          streamRef.current.removeTrack(previousTrack);
          previousTrack.stop();
        }
        streamRef.current.addTrack(next);
        const settings = next.getSettings();

        setState((previous) => ({
          ...previous,
          stream: streamRef.current,
          videoTrack: next,
          cameraId: deviceId,
          resolution: settings.width && settings.height ? { width: settings.width, height: settings.height } : null,
          supportsUvcControls: detectUvc(next),
          error: null,
        }));
        return next;
      } catch (error) {
        setState((previous) => ({ ...previous, error: describe(error) }));
        return null;
      } finally {
        replacingRef.current = false;
      }
    },
    [],
  );

  const switchMicrophone = useCallback(async (deviceId: string) => {
    if (!streamRef.current) return null;
    try {
      const audio = (await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } }))
        .getAudioTracks()[0];
      if (!audio) return null;
      streamRef.current.getAudioTracks().forEach((track) => {
        streamRef.current?.removeTrack(track);
        track.stop();
      });
      streamRef.current.addTrack(audio);
      setState((previous) => ({ ...previous, stream: streamRef.current, microphoneId: deviceId }));
      return audio;
    } catch (error) {
      setState((previous) => ({ ...previous, error: describe(error) }));
      return null;
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setState((previous) => ({ ...previous, stream: null, videoTrack: null, permission: "idle" }));
  }, []);

  useEffect(() => {
    void refreshDevices();
    const handler = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
    };
  }, [refreshDevices]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { ...state, request, switchCamera, switchMicrophone, stop, refreshDevices };
}

function detectUvc(track: MediaStreamTrack | null): boolean {
  if (!track || typeof track.getCapabilities !== "function") return false;
  try {
    const capabilities = track.getCapabilities() as Record<string, unknown>;
    return ["zoom", "exposureTime", "whiteBalanceMode", "exposureCompensation"].some(
      (key) => key in capabilities,
    );
  } catch {
    return false;
  }
}

export interface UvcState {
  zoom?: number;
  exposure?: number;
  whiteBalance?: number;
}

export async function applyUvc(track: MediaStreamTrack, controls: UvcState) {
  const caps = track.getCapabilities() as Record<string, { min?: number; max?: number; step?: number }>;
  const advanced: Record<string, number> = {};
  if (controls.zoom !== undefined && caps.zoom) advanced.zoom = controls.zoom;
  if (controls.exposure !== undefined && caps.exposureTime) advanced.exposureTime = controls.exposure;
  if (controls.whiteBalance !== undefined && caps.colorTemperature) {
    advanced.colorTemperature = controls.whiteBalance;
  }
  if (Object.keys(advanced).length === 0) return false;
  try {
    await track.applyConstraints({ advanced: [advanced] } as MediaTrackConstraints);
    return true;
  } catch {
    return false;
  }
}
