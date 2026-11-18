import { composePhoto, type ComposeInput } from "../compose";
import type { FilterId, LayoutType, Tier } from "../types";
import type { FrameSpec } from "../frames";

export interface ComposeRequest {
  id: string;
  kind: "compose";
  input: Omit<ComposeInput, "shots"> & {
    shots: Array<Record<string, { bitmap: ImageBitmap }>>;
  };
}

export interface EncodeRequest {
  id: string;
  kind: "encode";
  width: number;
  height: number;
  frames: ImageBitmap[];
  fps: number;
  /** Appends the reversed frames, producing the classic boomerang loop. */
  pingPong?: boolean;
}

export interface WorkerError {
  id: string;
  kind: "error";
  message: string;
}

export type WorkerRequest = ComposeRequest | EncodeRequest;

export type ComposeSuccess = { id: string; kind: "compose"; blob: Blob };
export type EncodeSuccess = { id: string; kind: "encode"; buffer: ArrayBuffer; mime: string };
export type WorkerResponse = ComposeSuccess | EncodeSuccess | WorkerError;

const scope = self as unknown as DedicatedWorkerGlobalScope;

async function handleCompose(request: ComposeRequest): Promise<ComposeSuccess> {
  const shots = request.input.shots.map((entry) => {
    const record: Record<string, { source: ImageBitmap; width: number; height: number }> = {};
    for (const [participantId, value] of Object.entries(entry)) {
      record[participantId] = {
        source: value.bitmap,
        width: value.bitmap.width,
        height: value.bitmap.height,
      };
    }
    return record;
  });

  const blob = await composePhoto({
    ...request.input,
    frame: request.input.frame as FrameSpec,
    layout: request.input.layout as LayoutType,
    tier: request.input.tier as Tier,
    filter: request.input.filter as FilterId,
    shots,
  });

  // release GPU/bitmap memory as soon as the PNG is produced
  for (const entry of request.input.shots) {
    for (const value of Object.values(entry)) value.bitmap.close();
  }

  return { id: request.id, kind: "compose", blob };
}

async function handleEncode(request: EncodeRequest): Promise<EncodeSuccess> {
  const { fps } = request;
  // H.264 requires even dimensions; the preview stage can be an odd size.
  const width = Math.max(2, request.width - (request.width % 2));
  const height = Math.max(2, request.height - (request.height % 2));
  const frames = request.pingPong
    ? [...request.frames, ...request.frames.slice(0, -1).reverse()]
    : request.frames;
  // One output frame per captured frame keeps the loop at the capture cadence.
  const totalFrames = Math.max(1, frames.length);

  if (typeof VideoEncoder === "undefined") {
    throw new Error("WebCodecs VideoEncoder is not available in this browser");
  }

  const muxerModule = await import("mp4-muxer");
  const target = new muxerModule.ArrayBufferTarget();
  const muxer = new muxerModule.Muxer({
    target,
    video: { codec: "avc", width, height, frameRate: fps },
    fastStart: "in-memory",
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (error) => {
      encoderError = error instanceof Error ? error : new Error(String(error));
    },
  });

  const config: VideoEncoderConfig = {
    codec: "avc1.42001f",
    width,
    height,
    bitrate: 6_000_000,
    framerate: fps,
    avc: { format: "avc" },
  };

  const support = await VideoEncoder.isConfigSupported(config).catch(() => null);
  if (!support?.supported) {
    const fallback: VideoEncoderConfig = { ...config, codec: "avc1.4d0028", bitrate: 8_000_000 };
    const fallbackSupport = await VideoEncoder.isConfigSupported(fallback).catch(() => null);
    if (!fallbackSupport?.supported) {
      throw new Error("H.264 encoding is not supported on this device");
    }
    encoder.configure(fallback);
  } else {
    encoder.configure(config);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable for video encoding");

  const frameDuration = 1_000_000 / fps;
  try {
    for (let i = 0; i < totalFrames; i += 1) {
      const bitmap = frames[i];
      if (!bitmap) continue;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(i * frameDuration),
        duration: Math.round(frameDuration),
      });
      encoder.encode(frame, { keyFrame: i % Math.max(1, fps) === 0 });
      frame.close();
      if (encoder.encodeQueueSize > 8) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (encoderError) throw encoderError;
    }

    await encoder.flush();
  } finally {
    // `close()` releases the codec even when a frame threw mid-loop.
    if (encoder.state !== "closed") encoder.close();
    for (const bitmap of frames) bitmap.close();
  }
  if (encoderError) throw encoderError;
  muxer.finalize();

  return {
    id: request.id,
    kind: "encode",
    buffer: target.buffer,
    mime: "video/mp4",
  };
}

scope.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  const run = request.kind === "compose" ? handleCompose(request) : handleEncode(request);
  run
    .then((response) => {
      scope.postMessage(response);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      scope.postMessage({ id: request.id, kind: "error", message } satisfies WorkerError);
    });
});
