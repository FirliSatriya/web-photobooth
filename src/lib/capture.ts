/**
 * High resolution local capture.
 *
 * The WebRTC video that other participants see is bitrate limited (typically
 * 1–2 Mbps), so screenshots of the remote stream look soft. Every device
 * therefore captures its *own* camera at full sensor resolution, right at the
 * synchronised shutter timestamp, and ships that frame to the host.
 */

export interface CapturedFrame {
  blob: Blob;
  width: number;
  height: number;
}

const CAPTURE_MIME_CANDIDATES = ["image/webp", "image/jpeg", "image/png"];

function pickMime(): string {
  if (typeof document === "undefined") return "image/webp";
  for (const mime of CAPTURE_MIME_CANDIDATES) {
    const canvas = document.createElement("canvas");
    if (canvas.toDataURL(mime).startsWith(`data:${mime}`)) return mime;
  }
  return "image/png";
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to capture frame"));
      },
      type,
      quality,
    );
  });
}

/**
 * Draws a video frame to a canvas honouring the mirror flag, then encodes a
 * still. Mirrored output is written into the pixels (not CSS) so the exported
 * photo matches exactly what the participant saw in their preview.
 */
export interface CaptureOptions {
  mirrored: boolean;
  maxEdge?: number;
  quality?: number;
  mime?: string;
}

export async function captureSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: CaptureOptions,
): Promise<CapturedFrame> {
  if (!sourceWidth || !sourceHeight) {
    throw new Error("Camera has not produced a frame yet");
  }

  const maxEdge = options.maxEdge ?? 2560;
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (options.mirrored) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, width, height);

  const mime = options.mime ?? pickMime();
  const quality = options.quality ?? 0.92;
  const blob = await canvasToBlob(canvas, mime, quality);
  return { blob, width, height };
}

export async function captureFrame(video: HTMLVideoElement, options: CaptureOptions): Promise<CapturedFrame> {
  return captureSource(video, video.videoWidth, video.videoHeight, options);
}

/**
 * Best-effort ImageCapture still. Some cameras expose a full-resolution photo
 * mode that is sharper than the video track. Falls back silently because
 * support is uneven (notably iOS Safari).
 */
export async function captureViaImageCapture(track: MediaStreamTrack): Promise<CapturedFrame | null> {
  const Ctor = (globalThis as { ImageCapture?: typeof ImageCapture }).ImageCapture;
  if (!Ctor) return null;
  try {
    const capture = new Ctor(track);
    const photoCapabilities = await capture.getPhotoCapabilities().catch(() => null);
    if (!photoCapabilities) return null;
    const bitmap = await (capture as ImageCapture & { grabFrame: () => Promise<ImageBitmap> }).grabFrame();
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const blob = await canvasToBlob(canvas, pickMime(), 0.92);
    return { blob, width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

/** Waits until the next decoded frame is available on the element. */
export function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (typeof video.requestVideoFrameCallback === "function") {
    return new Promise((resolve) => {
      const timer = window.setTimeout(resolve, 500);
      video.requestVideoFrameCallback(() => {
        window.clearTimeout(timer);
        resolve();
      });
    });
  }
  return new Promise((resolve) => window.setTimeout(resolve, 120));
}

/**
 * Schedules a callback on a target Date.now() timestamp (sub-frame accuracy).
 *
 * The final 40 ms use requestAnimationFrame so the shutter lands on a paint
 * boundary, but rAF is suspended while a tab is hidden — a participant who
 * switches apps would miss the shot entirely. In that case we fall back to a
 * timer, which browsers only throttle to ~1 s, and the frame is still captured.
 */
export function scheduleAt(targetTs: number, callback: () => void): () => void {
  let raf = 0;
  let timeout = 0;
  let cancelled = false;

  const tick = () => {
    if (cancelled) return;
    const remaining = targetTs - Date.now();
    if (remaining <= 0) {
      callback();
      return;
    }
    if (remaining > 40) {
      timeout = window.setTimeout(tick, remaining - 30);
      return;
    }
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      raf = window.requestAnimationFrame(tick);
    } else {
      timeout = window.setTimeout(tick, 10);
    }
  };
  tick();

  return () => {
    cancelled = true;
    window.clearTimeout(timeout);
    window.cancelAnimationFrame(raf);
  };
}
