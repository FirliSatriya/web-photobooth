"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface BackdropPreset {
  id: string;
  name: string;
  colors: [string, string];
  style: "studio" | "gradient" | "spotlight" | "grid";
}

export const BACKDROPS: BackdropPreset[] = [
  { id: "peach", name: "Peach Studio", colors: ["#f6c9b4", "#e9a18f"], style: "studio" },
  { id: "mint", name: "Mint Room", colors: ["#bfe6d6", "#8ecdb4"], style: "studio" },
  { id: "sky", name: "Sky Blue", colors: ["#bfd7f7", "#93b8ef"], style: "gradient" },
  { id: "lilac", name: "Lilac", colors: ["#ded0f5", "#bfa9ea"], style: "gradient" },
  { id: "noir", name: "Noir Studio", colors: ["#2b2b31", "#161619"], style: "spotlight" },
  { id: "grid", name: "Graph Grid", colors: ["#1f3b57", "#122438"], style: "grid" },
];

function paintBackdrop(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  preset: BackdropPreset,
  width: number,
  height: number,
) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, preset.colors[0]);
  gradient.addColorStop(1, preset.colors[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (preset.style === "spotlight") {
    const glow = ctx.createRadialGradient(width / 2, height * 0.36, 0, width / 2, height * 0.36, height * 0.8);
    glow.addColorStop(0, "rgba(255,255,255,0.22)");
    glow.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  if (preset.style === "grid") {
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = Math.max(1, width / 900);
    const step = width / 22;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  if (preset.style === "gradient" || preset.style === "studio") {
    const floor = ctx.createLinearGradient(0, height * 0.6, 0, height);
    floor.addColorStop(0, "rgba(0,0,0,0)");
    floor.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = floor;
    ctx.fillRect(0, 0, width, height);
  }
}

type Segmenter = {
  segmentForVideo: (frame: HTMLVideoElement, timestamp: number) => {
    categoryMask?: {
      width: number;
      height: number;
      getAsFloat32Array: () => Float32Array;
      close: () => void;
    };
  };
  close: () => void;
};

/**
 * Selfie-segmentation based virtual studio (Pro tier).
 *
 * The WASM runtime is copied to /public/mediapipe by scripts/copy-mediapipe.mjs
 * and the model is fetched once by scripts/fetch-model.mjs. Both live locally,
 * so no user video ever leaves the device — the segmentation runs entirely in
 * the browser and the composited frames are what get sent to peers.
 */
export function useVirtualBackdrop() {
  const [presetId, setPresetId] = useState<string>(BACKDROPS[0].id);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const segmenterRef = useRef<Segmenter | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const personCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTsRef = useRef(0);
  const renderErrorRef = useRef<string | null>(null);

  const fail = useCallback((cause: unknown) => {
    if (renderErrorRef.current) return;
    const message = cause instanceof Error ? cause.message : String(cause);
    renderErrorRef.current = message;
    setError(`Segmentasi gagal: ${message}`);
    console.warn("[pb-backdrop]", message);
  }, []);

  const load = useCallback(async () => {
    if (segmenterRef.current) return true;
    setLoading(true);
    setError(null);
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const build = (delegate: "GPU" | "CPU") =>
        vision.ImageSegmenter.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "/models/selfie_segmenter.tflite",
            delegate,
          },
          runningMode: "VIDEO",
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
      let segmenter;
      try {
        segmenter = await build("GPU");
      } catch {
        // Older GPUs / blocked WebGL: the WASM (CPU) delegate still keeps the
        // feature usable, just slower.
        segmenter = await build("CPU");
      }
      segmenterRef.current = segmenter as unknown as Segmenter;
      setReady(true);
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(
        /model|fetch|404|failed to fetch/i.test(message)
          ? "Model AI belum tersedia. Jalankan `node scripts/fetch-model.mjs` lalu muat ulang halaman."
          : `Gagal memuat segmentasi: ${message}`,
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const preset = BACKDROPS.find((item) => item.id === presetId) ?? BACKDROPS[0];

  /**
   * Draws the segmented subject over the studio preset into `target`.
   * Used by the 30 fps preview loop *and* by the full-resolution capture, so
   * the photo matches what the participant saw.
   */
  const render = useCallback(
    (
      video: HTMLVideoElement,
      target: HTMLCanvasElement,
      options: { mirrored: boolean; width?: number; height?: number },
    ): boolean => {
      const segmenter = segmenterRef.current;
      if (!segmenter) return false;
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      if (!sourceWidth || !sourceHeight) return false;

      const width = Math.round(options.width ?? sourceWidth);
      const height = Math.round(options.height ?? sourceHeight);
      if (target.width !== width) target.width = width;
      if (target.height !== height) target.height = height;
      const ctx = target.getContext("2d");
      if (!ctx) return false;

      let result: ReturnType<Segmenter["segmentForVideo"]>;
      try {
        const timestamp = Math.max(performance.now(), lastTsRef.current + 1);
        lastTsRef.current = timestamp;
        result = segmenter.segmentForVideo(video, timestamp);
      } catch (cause) {
        fail(cause);
        return false;
      }

      const mask = result.categoryMask;
      if (!mask) {
        fail(new Error("category mask kosong"));
        return false;
      }
      let values: Float32Array;
      try {
        values = mask.getAsFloat32Array();
      } catch (cause) {
        fail(cause);
        mask.close();
        return false;
      }
      const maskWidth = mask.width;
      const maskHeight = mask.height;

      if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement("canvas");
      if (!personCanvasRef.current) personCanvasRef.current = document.createElement("canvas");
      const maskCanvas = maskCanvasRef.current;
      const personCanvas = personCanvasRef.current;

      maskCanvas.width = maskWidth;
      maskCanvas.height = maskHeight;
      personCanvas.width = sourceWidth;
      personCanvas.height = sourceHeight;

      const maskCtx = maskCanvas.getContext("2d");
      const personCtx = personCanvas.getContext("2d");
      if (!maskCtx || !personCtx) {
        mask.close();
        return false;
      }

      // The selfie segmenter labels person pixels as category 0 and background
      // as category 1, so alpha is the *inverse* of the raw mask value.
      const imageData = maskCtx.createImageData(maskWidth, maskHeight);
      for (let i = 0; i < values.length; i += 1) {
        imageData.data[i * 4] = 255;
        imageData.data[i * 4 + 1] = 255;
        imageData.data[i * 4 + 2] = 255;
        imageData.data[i * 4 + 3] = values[i] > 0.5 ? 0 : 255;
      }
      maskCtx.putImageData(imageData, 0, 0);

      personCtx.clearRect(0, 0, sourceWidth, sourceHeight);
      personCtx.save();
      if (options.mirrored) {
        personCtx.translate(sourceWidth, 0);
        personCtx.scale(-1, 1);
      }
      personCtx.drawImage(video, 0, 0, sourceWidth, sourceHeight);
      personCtx.restore();
      personCtx.globalCompositeOperation = "destination-in";
      personCtx.drawImage(maskCanvas, 0, 0, sourceWidth, sourceHeight);
      personCtx.globalCompositeOperation = "source-over";

      ctx.clearRect(0, 0, width, height);
      paintBackdrop(ctx, preset, width, height);
      ctx.drawImage(personCanvas, 0, 0, width, height);

      mask.close();
      return true;
    },
    [preset, fail],
  );

  useEffect(() => {
    return () => {
      segmenterRef.current?.close();
      segmenterRef.current = null;
    };
  }, []);

  return {
    enabled,
    setEnabled,
    ready,
    loading,
    error,
    preset,
    presetId,
    setPresetId,
    presets: BACKDROPS,
    render,
    load,
  };
}
