import type { FrameSpec } from "./frames";
import { LAYOUT_SHOTS, getGeometry, roundRectPath, type Geometry, type Rect } from "./layout";
import type { FilterId, LayoutType, Tier } from "./types";
import { FILTER_CSS, FilterSurface } from "./filters";

export type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface PhotoLike {
  source: CanvasImageSource;
  width: number;
  height: number;
  label?: string;
}

export interface ComposeInput {
  layout: LayoutType;
  tier: Tier;
  frame: FrameSpec;
  filter: FilterId;
  participantIds: string[];
  participantLabels: Record<string, string>;
  /** shots[shotIndex][participantId] */
  shots: Array<Record<string, PhotoLike | undefined>>;
  watermark: boolean;
  roomCode: string;
  dateStamp: string;
  longEdge: number;
  overlay?: CanvasImageSource | null;
  backdropTint?: string | null;
}

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function ctx2d(canvas: AnyCanvas): Canvas2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: false }) as Canvas2D | null;
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return ctx;
}

/** Draws an image with object-fit: cover semantics (centre crop, no stretching). */
export function drawCover(
  ctx: Canvas2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!sourceWidth || !sourceHeight || w <= 0 || h <= 0) return;
  const targetAspect = w / h;
  const sourceAspect = sourceWidth / sourceHeight;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceAspect > targetAspect) {
    sw = sourceHeight * targetAspect;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetAspect;
    sy = (sourceHeight - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

export function paintPaper(ctx: Canvas2D, geo: Geometry, frame: FrameSpec) {
  const { width, height } = geo;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, frame.paper);
  gradient.addColorStop(1, shade(frame.paper, -0.06));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const unit = geo.longEdge / 1000;

  if (frame.style === "film" || frame.style === "noir") {
    // film grain speckle + vignette on the paper
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = frame.ink;
    for (let i = 0; i < 340; i += 1) {
      const x = pseudo(i * 3.1) * width;
      const y = pseudo(i * 7.7 + 13) * height;
      const r = (0.6 + pseudo(i * 1.3) * 1.6) * unit;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (frame.style === "neon") {
    const glow = ctx.createRadialGradient(width * 0.16, height * 0.1, 0, width * 0.16, height * 0.1, height * 0.7);
    glow.addColorStop(0, withAlpha(frame.secondary, 0.5));
    glow.addColorStop(0.55, withAlpha(frame.accent, 0.13));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    const glow2 = ctx.createRadialGradient(width * 0.9, height * 0.92, 0, width * 0.9, height * 0.92, height * 0.6);
    glow2.addColorStop(0, withAlpha(frame.accent, 0.35));
    glow2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, width, height);
  }

  if (frame.style === "retro") {
    ctx.save();
    ctx.strokeStyle = withAlpha(frame.ink, 0.16);
    ctx.lineWidth = Math.max(1, unit * 2);
    for (let i = 0; i < 26; i += 1) {
      const y = (i / 26) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y - height * 0.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (frame.style === "bloom") {
    ctx.save();
    for (let i = 0; i < 14; i += 1) {
      const cx = pseudo(i * 5.7) * width;
      const cy = pseudo(i * 2.9 + 4) * height;
      const r = (30 + pseudo(i * 9.3) * 70) * unit;
      const petal = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      petal.addColorStop(0, withAlpha(frame.secondary, 0.5));
      petal.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = petal;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (frame.style === "pop") {
    ctx.save();
    ctx.fillStyle = withAlpha(frame.accent, 0.1);
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height * 0.34);
    ctx.lineTo(width * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = withAlpha(frame.secondary, 0.12);
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, height * 0.72);
    ctx.lineTo(width * 0.26, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function cellRadius(geo: Geometry, frame: FrameSpec): number {
  const unit = geo.longEdge / 1000;
  switch (frame.style) {
    case "studio":
      return 10 * unit;
    case "bloom":
      return 26 * unit;
    case "neon":
      return 8 * unit;
    case "pop":
      return 4 * unit;
    default:
      return 3 * unit;
  }
}

export interface CellPaintTarget {
  cell: Rect;
  shotIndex: number;
  participantIndex: number;
  participantId: string;
}

/**
 * Paints the photo cells for one shot. The caller supplies the photo drawing
 * routine so the live preview (video source) and the export (bitmap source)
 * share exactly the same clipping and geometry.
 */
export function withShotCells(
  ctx: Canvas2D,
  geo: Geometry,
  frame: FrameSpec,
  shotIndex: number,
  participantIds: string[],
  paint: (target: CellPaintTarget) => void,
  options: { placeholder?: boolean } = {},
) {
  const shot = geo.shots[shotIndex];
  if (!shot) return;
  const radius = cellRadius(geo, frame);
  const unit = geo.longEdge / 1000;

  shot.cells.forEach((cell, participantIndex) => {
    const participantId = participantIds[participantIndex] ?? `p${participantIndex}`;
    ctx.save();
    roundRectPath(ctx, cell.x, cell.y, cell.w, cell.h, radius);
    ctx.clip();

    if (options.placeholder) {
      const bg = ctx.createLinearGradient(cell.x, cell.y, cell.x + cell.w, cell.y + cell.h);
      bg.addColorStop(0, withAlpha(frame.ink, 0.14));
      bg.addColorStop(1, withAlpha(frame.ink, 0.05));
      ctx.fillStyle = bg;
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      ctx.restore();
      return;
    }

    paint({ cell, shotIndex, participantIndex, participantId });
    ctx.restore();

    // inner hairline to separate stacked cells visually
    ctx.save();
    roundRectPath(ctx, cell.x, cell.y, cell.w, cell.h, radius);
    ctx.strokeStyle = withAlpha(frame.paper, frame.style === "film" || frame.style === "neon" ? 0.18 : 0.55);
    ctx.lineWidth = Math.max(1, unit * 1.1);
    ctx.stroke();
    ctx.restore();
  });

  // slot border
  ctx.save();
  roundRectPath(ctx, shot.rect.x, shot.rect.y, shot.rect.w, shot.rect.h, radius + unit * 2);
  ctx.strokeStyle = withAlpha(frame.ink, frame.style === "neon" ? 0.4 : 0.14);
  ctx.lineWidth = Math.max(1, unit * 1.4);
  ctx.stroke();
  ctx.restore();
}

export function drawFrameOrnaments(
  ctx: Canvas2D,
  geo: Geometry,
  frame: FrameSpec,
  options: {
    roomCode: string;
    dateStamp: string;
    tier: Tier;
    watermark: boolean;
    participantCount: number;
    layout: LayoutType;
  },
) {
  const { width, height, caption } = geo;
  const unit = geo.longEdge / 1000;
  const ink = frame.ink;

  if (frame.style === "film") {
    // 35mm perforations down both edges
    const perfW = 26 * unit;
    const perfH = 18 * unit;
    const gap = 34 * unit;
    ctx.save();
    ctx.fillStyle = withAlpha("#000000", 0.78);
    ctx.fillRect(0, 0, perfW, height);
    ctx.fillRect(width - perfW, 0, perfW, height);
    ctx.fillStyle = withAlpha(frame.paper, 0.92);
    for (let y = gap; y < height - perfH; y += perfH + gap) {
      roundRectPath(ctx, (perfW - 14 * unit) / 2, y, 14 * unit, perfH, 3 * unit);
      ctx.fill();
      roundRectPath(ctx, width - perfW + (perfW - 14 * unit) / 2, y, 14 * unit, perfH, 3 * unit);
      ctx.fill();
    }
    ctx.restore();
  }

  if (frame.style === "neon") {
    ctx.save();
    const neon = ctx.createLinearGradient(0, 0, width, height);
    neon.addColorStop(0, frame.accent);
    neon.addColorStop(1, frame.secondary);
    ctx.strokeStyle = neon;
    ctx.lineWidth = Math.max(2, 4 * unit);
    ctx.shadowColor = frame.accent;
    ctx.shadowBlur = 24 * unit;
    roundRectPath(ctx, geo.padding * 0.55, geo.padding * 0.55, width - geo.padding * 1.1, height - geo.padding * 1.1, 12 * unit);
    ctx.stroke();
    ctx.restore();
  }

  if (frame.style === "retro" || frame.style === "pop") {
    ctx.save();
    ctx.fillStyle = frame.accent;
    ctx.fillRect(0, 0, width, 14 * unit);
    ctx.fillStyle = frame.secondary;
    ctx.fillRect(0, height - 14 * unit, width, 14 * unit);
    ctx.restore();
  }

  // caption block
  const cx = caption.x;
  const cy = caption.y;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ink;

  const titleSize = caption.h * 0.34;
  if (frame.style === "mono" || frame.style === "film") {
    ctx.font = `700 ${titleSize}px ${SANS}`;
    spacedText(ctx, "PHOTOBOOTH", cx, cy + caption.h * 0.46, titleSize * 0.16);
  } else if (frame.style === "neon") {
    ctx.font = `800 ${titleSize}px ${SANS}`;
    ctx.fillStyle = frame.accent;
    spacedText(ctx, "NEON NIGHT", cx, cy + caption.h * 0.46, titleSize * 0.1);
  } else if (frame.style === "retro") {
    ctx.font = `700 ${titleSize}px ${SERIF}`;
    spacedText(ctx, "SUNSHINE CLUB", cx, cy + caption.h * 0.46, titleSize * 0.06);
  } else if (frame.style === "bloom") {
    ctx.font = `italic 600 ${titleSize}px ${SERIF}`;
    ctx.fillStyle = frame.accent;
    ctx.fillText("bloom", cx, cy + caption.h * 0.46);
    ctx.font = `500 ${titleSize * 0.52}px ${SANS}`;
    ctx.fillStyle = withAlpha(ink, 0.7);
    ctx.fillText("together, apart", cx + titleSize * 1.5, cy + caption.h * 0.48);
  } else if (frame.style === "pop") {
    ctx.font = `800 ${titleSize}px ${SANS}`;
    ctx.fillStyle = frame.accent;
    spacedText(ctx, "POP!", cx, cy + caption.h * 0.46, titleSize * 0.05);
  } else {
    ctx.font = `600 ${titleSize * 0.82}px ${SANS}`;
    spacedText(ctx, "REMOTE PHOTOBOOTH", cx, cy + caption.h * 0.45, titleSize * 0.14);
  }

  // date stamp / room code row
  const subSize = caption.h * 0.17;
  ctx.font = `500 ${subSize}px ${MONO}`;
  ctx.fillStyle = withAlpha(ink, 0.62);
  ctx.fillText(`${options.dateStamp}  ·  ROOM ${options.roomCode}`, cx, cy + caption.h * 0.74);

  ctx.textAlign = "right";
  ctx.font = `600 ${subSize}px ${MONO}`;
  ctx.fillStyle = frame.accent;
  ctx.fillText(options.tier === "paid" ? "SESSION PASS" : "FREE SESSION", cx + caption.w, cy + caption.h * 0.74);
  ctx.textAlign = "left";
  ctx.restore();

  // side tick marks for the classic paper look
  if (frame.style === "classic" || frame.style === "studio") {
    ctx.save();
    ctx.fillStyle = frame.accent;
    const tickW = 34 * unit;
    const tickH = 5 * unit;
    ctx.fillRect(cx, cy + caption.h * 0.9, tickW, tickH);
    ctx.fillStyle = withAlpha(ink, 0.2);
    ctx.fillRect(cx + tickW + 10 * unit, cy + caption.h * 0.9, tickW * 0.5, tickH);
    ctx.restore();
  }

  if (options.watermark) {
    drawWatermark(ctx, geo, frame);
  }
}

function drawWatermark(ctx: Canvas2D, geo: Geometry, frame: FrameSpec) {
  const unit = geo.longEdge / 1000;
  const size = 20 * unit;
  ctx.save();
  ctx.font = `700 ${size}px ${SANS}`;
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = Math.max(1, unit * 1.2);
  const text = "photobooth.web";
  ctx.textAlign = "right";
  const x = geo.width - geo.padding * 0.8;
  const y = geo.height - geo.padding * 0.45;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function spacedText(ctx: Canvas2D, text: string, x: number, y: number, spacing: number) {
  const anyCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if (typeof anyCtx.letterSpacing === "string") {
    const previous = anyCtx.letterSpacing;
    anyCtx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, x, y);
    anyCtx.letterSpacing = previous;
    return;
  }
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  }
}

function pseudo(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function shade(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  const channels = [0, 2, 4].map((i) => {
    const value = parseInt(full.slice(i, i + 2), 16);
    const next = amount < 0 ? value * (1 + amount) : value + (255 - value) * amount;
    return Math.round(Math.max(0, Math.min(255, next)));
  });
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Composes the final photo (used from the Web Worker, see compose.worker.ts). */
export async function composePhoto(input: ComposeInput): Promise<Blob> {
  const participantCount = Math.max(1, input.participantIds.length);
  const geo = getGeometry(input.layout, participantCount, input.longEdge);
  const canvas = makeCanvas(geo.width, geo.height);
  const ctx = ctx2d(canvas);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  paintPaper(ctx, geo, input.frame);

  const surface = new FilterSurface(geo.width, geo.height, makeCanvas(geo.width, geo.height));
  const scratch = makeCanvas(geo.width, geo.height);
  const scratchCtx = ctx2d(scratch);

  const shotCount = LAYOUT_SHOTS[input.layout];
  for (let shotIndex = 0; shotIndex < shotCount; shotIndex += 1) {
    const shotSources = input.shots[shotIndex] ?? {};
    withShotCells(
      ctx,
      geo,
      input.frame,
      shotIndex,
      input.participantIds,
      ({ cell, participantId }) => {
        const photo = shotSources[participantId];
        if (!photo) {
          const bg = ctx.createLinearGradient(cell.x, cell.y, cell.x + cell.w, cell.y + cell.h);
          bg.addColorStop(0, withAlpha(input.frame.ink, 0.2));
          bg.addColorStop(1, withAlpha(input.frame.ink, 0.06));
          ctx.fillStyle = bg;
          ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
          ctx.fillStyle = withAlpha(input.frame.ink, 0.45);
          ctx.font = `600 ${Math.max(12, cell.w * 0.05)}px ${SANS}`;
          ctx.textAlign = "center";
          ctx.fillText("no signal", cell.x + cell.w / 2, cell.y + cell.h / 2);
          ctx.textAlign = "left";
          return;
        }

        // 1. centre-crop the raw high-res frame into the slot rect on a scratch
        //    surface (object-fit: cover semantics, never stretched)
        scratchCtx.clearRect(0, 0, geo.width, geo.height);
        scratchCtx.imageSmoothingQuality = "high";
        drawCover(scratchCtx, photo.source, photo.width, photo.height, cell.x, cell.y, cell.w, cell.h);

        // 2. GPU colour grading of the same region, one shared WebGL surface
        if (input.filter !== "none" && surface.render(scratch, input.filter)) {
          ctx.drawImage(surface.canvas, cell.x, cell.y, cell.w, cell.h, cell.x, cell.y, cell.w, cell.h);
          return;
        }

        if (input.filter !== "none") {
          // GPU unavailable (older browser / worker): canvas 2D fallback keeps
          // preview and export visually aligned.
          ctx.save();
          ctx.filter = FILTER_CSS[input.filter];
          ctx.drawImage(scratch, cell.x, cell.y, cell.w, cell.h, cell.x, cell.y, cell.w, cell.h);
          ctx.restore();
          return;
        }

        ctx.drawImage(scratch, cell.x, cell.y, cell.w, cell.h, cell.x, cell.y, cell.w, cell.h);
      },
    );
  }

  // AI backdrop tint (only relevant when segmentation is off)
  if (input.backdropTint) {
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = input.backdropTint;
    ctx.fillRect(0, 0, geo.width, geo.height);
    ctx.restore();
  }

  drawFrameOrnaments(ctx, geo, input.frame, {
    roomCode: input.roomCode,
    dateStamp: input.dateStamp,
    tier: input.tier,
    watermark: input.watermark,
    participantCount,
    layout: input.layout,
  });

  if (input.overlay) {
    ctx.drawImage(input.overlay, 0, 0, geo.width, geo.height);
  }

  // the bare surface variable is intentional: keeps the WebGL context alive
  // until the bitmap has been read back.
  void surface;

  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: "image/png" });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode canvas"));
    }, "image/png");
  });
}
