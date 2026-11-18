"use client";

import { Camera, Mic, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Label, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { DeviceOption } from "@/hooks/useLocalMedia";

export interface DevicePickerProps {
  cameras: DeviceOption[];
  microphones: DeviceOption[];
  cameraId: string | null;
  microphoneId: string | null;
  resolution: { width: number; height: number } | null;
  onCamera: (deviceId: string) => void;
  onMicrophone: (deviceId: string) => void;
  onRefresh: () => void;
  disabled?: boolean;
}

export function DevicePicker({
  cameras,
  microphones,
  cameraId,
  microphoneId,
  resolution,
  onCamera,
  onMicrophone,
  onRefresh,
  disabled,
}: DevicePickerProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label hint={resolution ? `${resolution.width}×${resolution.height}` : undefined}>
          <span className="inline-flex items-center gap-1.5">
            <Camera className="h-3 w-3" /> Kamera
          </span>
        </Label>
        <div className="flex gap-2">
          <Select
            value={cameraId ?? ""}
            disabled={disabled || cameras.length === 0}
            onChange={(event) => onCamera(event.target.value)}
            aria-label="Pilih kamera"
          >
            {cameras.length === 0 ? <option value="">Belum ada kamera</option> : null}
            {cameras.map((camera, index) => (
              <option key={camera.deviceId || index} value={camera.deviceId}>
                {camera.label}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Muat ulang daftar perangkat"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/12 bg-black/35 text-white/50 transition hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <Label>
          <span className="inline-flex items-center gap-1.5">
            <Mic className="h-3 w-3" /> Mikrofon
          </span>
        </Label>
        <Select
          value={microphoneId ?? ""}
          disabled={disabled || microphones.length === 0}
          onChange={(event) => onMicrophone(event.target.value)}
          aria-label="Pilih mikrofon"
        >
          {microphones.length === 0 ? <option value="">Belum ada mikrofon</option> : null}
          {microphones.map((mic, index) => (
            <option key={mic.deviceId || index} value={mic.deviceId}>
              {mic.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

export interface UvcPanelProps {
  enabled: boolean;
  values: { zoom: number; exposure: number; whiteBalance: number };
  onChange: (values: { zoom: number; exposure: number; whiteBalance: number }) => void;
  locked: boolean;
  onUnlock: () => void;
}

/** Hardware UVC controls (PRD 5.A — Session Pass only). */
export function UvcPanel({ enabled, values, onChange, locked, onUnlock }: UvcPanelProps) {
  if (!enabled) return null;

  const rows: Array<{ key: keyof UvcPanelProps["values"]; label: string; min: number; max: number }> = [
    { key: "zoom", label: "Zoom", min: 100, max: 400 },
    { key: "exposure", label: "Exposure", min: 10, max: 500 },
    { key: "whiteBalance", label: "White balance (K)", min: 2800, max: 7000 },
  ];

  return (
    <div className="relative rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          <SlidersHorizontal className="h-3 w-3" /> Kontrol UVC
        </span>
        {locked ? (
          <button type="button" onClick={onUnlock} className="text-[11px] font-medium text-[#f6d9a8] hover:underline">
            Buka dengan Session Pass
          </button>
        ) : null}
      </div>
      <div className={cn("space-y-3", locked && "pointer-events-none opacity-40")}>
        {rows.map((row) => (
          <label key={row.key} className="block">
            <span className="mb-1 flex items-baseline justify-between text-xs text-white/50">
              {row.label}
              <span className="font-mono text-white/35">{values[row.key]}</span>
            </span>
            <input
              type="range"
              min={row.min}
              max={row.max}
              step={(row.max - row.min) / 20}
              value={values[row.key]}
              onChange={(event) => onChange({ ...values, [row.key]: Number(event.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-flame"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
