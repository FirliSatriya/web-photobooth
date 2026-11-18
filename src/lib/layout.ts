import type { LayoutType } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ShotGeometry {
  index: number;
  rect: Rect;
  cells: Rect[];
}

export interface Geometry {
  width: number;
  height: number;
  padding: number;
  gap: number;
  caption: Rect;
  shots: ShotGeometry[];
  /** long edge used to build the geometry (useful for scaling strokes) */
  longEdge: number;
}

interface BaseSpec {
  cols: number;
  rows: number;
  shotW: number;
  shotH: number;
  padding: number;
  gap: number;
  caption: number;
}

const BASE: Record<LayoutType, BaseSpec> = {
  "1x4_strip": { cols: 1, rows: 4, shotW: 1080, shotH: 810, padding: 60, gap: 36, caption: 178 },
  "2x2_grid": { cols: 2, rows: 2, shotW: 900, shotH: 900, padding: 60, gap: 36, caption: 178 },
  "1x2_wide": { cols: 2, rows: 1, shotW: 1080, shotH: 1350, padding: 60, gap: 36, caption: 178 },
};

export const LAYOUT_SHOTS: Record<LayoutType, number> = {
  "1x4_strip": 4,
  "2x2_grid": 4,
  "1x2_wide": 2,
};

/**
 * Splits a slot into per-participant cells. The arrangement follows the slot
 * shape so faces are never squeezed into extreme slivers:
 *  - tall slots stack participants (keeps a video friendly aspect)
 *  - wide slots place participants side by side
 *  - 4 participants always use a 2x2 matrix
 */
function cellRects(shot: Rect, count: number, gap: number): Rect[] {
  const n = Math.max(1, Math.min(4, count));
  if (n === 1) return [{ ...shot }];
  const portraitSlot = shot.w / shot.h < 1.1;

  if (n === 3) {
    const topH = (shot.h - gap) / 2;
    const bottomH = shot.h - topH - gap;
    const cw = (shot.w - gap) / 2;
    return [
      { x: shot.x, y: shot.y, w: cw, h: topH },
      { x: shot.x + cw + gap, y: shot.y, w: cw, h: topH },
      { x: shot.x, y: shot.y + topH + gap, w: shot.w, h: bottomH },
    ];
  }

  if (n === 4) {
    const cw = (shot.w - gap) / 2;
    const ch = (shot.h - gap) / 2;
    return [
      { x: shot.x, y: shot.y, w: cw, h: ch },
      { x: shot.x + cw + gap, y: shot.y, w: cw, h: ch },
      { x: shot.x, y: shot.y + ch + gap, w: cw, h: ch },
      { x: shot.x + cw + gap, y: shot.y + ch + gap, w: cw, h: ch },
    ];
  }

  if (portraitSlot) {
    const ch = (shot.h - gap) / 2;
    return [
      { x: shot.x, y: shot.y, w: shot.w, h: ch },
      { x: shot.x, y: shot.y + ch + gap, w: shot.w, h: shot.h - ch - gap },
    ];
  }

  const cw = (shot.w - gap) / 2;
  return [
    { x: shot.x, y: shot.y, w: cw, h: shot.h },
    { x: shot.x + cw + gap, y: shot.y, w: shot.w - cw - gap, h: shot.h },
  ];
}

/**
 * Builds a pixel geometry for a layout. All rects are expressed in final-image
 * pixels, so the same geometry can be used for the live preview (small long
 * edge) and for the high-resolution export (tier dependent long edge).
 */
export function getGeometry(
  layout: LayoutType,
  participantCount: number,
  longEdge = 1600,
): Geometry {
  const spec = BASE[layout];
  const baseWidth = spec.padding * 2 + spec.cols * spec.shotW + (spec.cols - 1) * spec.gap;
  const baseHeight =
    spec.padding * 2 + spec.rows * spec.shotH + (spec.rows - 1) * spec.gap + spec.caption;
  const scale = longEdge / Math.max(baseWidth, baseHeight);

  const width = Math.round(baseWidth * scale);
  const height = Math.round(baseHeight * scale);
  const padding = Math.round(spec.padding * scale);
  const gap = Math.round(spec.gap * scale);
  const cellGap = Math.max(2, Math.round(10 * scale));
  const captionHeight = Math.round(spec.caption * scale);
  const shotW = (width - padding * 2 - gap * (spec.cols - 1)) / spec.cols;
  const shotH = (height - padding * 2 - captionHeight - gap * (spec.rows - 1)) / spec.rows;

  const shots: ShotGeometry[] = [];
  for (let row = 0; row < spec.rows; row += 1) {
    for (let col = 0; col < spec.cols; col += 1) {
      const index = row * spec.cols + col;
      const rect: Rect = {
        x: Math.round(padding + col * (shotW + gap)),
        y: Math.round(padding + row * (shotH + gap)),
        w: Math.round(shotW),
        h: Math.round(shotH),
      };
      shots.push({ index, rect, cells: cellRects(rect, participantCount, cellGap) });
    }
  }

  return {
    width,
    height,
    padding,
    gap,
    longEdge: Math.max(width, height),
    caption: {
      x: padding,
      y: height - padding - captionHeight,
      w: width - padding * 2,
      h: captionHeight,
    },
    shots,
  };
}

/** Normalised slot coordinates, ready to be stored in the frames table (JSONB). */
export function slotCoordinates(layout: LayoutType, participantCount: number) {
  const geo = getGeometry(layout, participantCount, 1000);
  return geo.shots.map((shot) => ({
    shot: shot.index,
    rect: {
      x: +(shot.rect.x / geo.width).toFixed(4),
      y: +(shot.rect.y / geo.height).toFixed(4),
      w: +(shot.rect.w / geo.width).toFixed(4),
      h: +(shot.rect.h / geo.height).toFixed(4),
    },
    cells: shot.cells.map((cell) => ({
      x: +((cell.x - shot.rect.x) / shot.rect.w).toFixed(4),
      y: +((cell.y - shot.rect.y) / shot.rect.h).toFixed(4),
      w: +(cell.w / shot.rect.w).toFixed(4),
      h: +(cell.h / shot.rect.h).toFixed(4),
    })),
  }));
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
