export interface Capabilities {
  webgl2: boolean;
  offscreen: boolean;
  worker: boolean;
  webcodecs: boolean;
  imageCapture: boolean;
  mediaDevices: boolean;
  indexedDb: boolean;
  canvas2d: boolean;
  sharedArrayBuffer: boolean;
  secureContext: boolean;
}

let cached: Capabilities | null = null;

function verifyWebgl2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}

export function detectCapabilities(): Capabilities {
  if (cached) return cached;
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  cached = {
    webgl2: typeof document === "undefined" ? false : verifyWebgl2(),
    offscreen: typeof OffscreenCanvas !== "undefined",
    worker: typeof Worker !== "undefined",
    webcodecs: typeof (globalThis as { VideoEncoder?: unknown }).VideoEncoder !== "undefined",
    imageCapture: typeof (globalThis as { ImageCapture?: unknown }).ImageCapture !== "undefined",
    mediaDevices: !!nav?.mediaDevices?.getUserMedia,
    indexedDb: typeof indexedDB !== "undefined",
    canvas2d: typeof document !== "undefined" && !!document.createElement("canvas").getContext("2d"),
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    secureContext: typeof window === "undefined" ? false : window.isSecureContext,
  };
  return cached;
}

export function webCodecsSupported(): boolean {
  return detectCapabilities().webcodecs;
}

export function supportsWebgl2(): boolean {
  return detectCapabilities().webgl2;
}

export function describeUnsupported(): string[] {
  const capabilities = detectCapabilities();
  const issues: string[] = [];
  if (!capabilities.secureContext) issues.push("Halaman harus dibuka lewat HTTPS atau localhost.");
  if (!capabilities.mediaDevices) issues.push("Peramban ini tidak mendukung akses kamera (getUserMedia).");
  if (!capabilities.canvas2d) issues.push("Canvas 2D tidak tersedia.");
  return issues;
}
