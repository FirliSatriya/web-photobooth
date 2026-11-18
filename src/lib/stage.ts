import type { FrameSpec } from "./frames";
import { makeCanvas, paintPaper, drawFrameOrnaments, withShotCells, type Canvas2D } from "./compose";
import { LAYOUT_SHOTS, getGeometry, type Geometry } from "./layout";
import type { LayoutType, Tier } from "./types";

export interface StageLayers {
  paper: HTMLCanvasElement | OffscreenCanvas;
  overlay: HTMLCanvasElement | OffscreenCanvas;
  geo: Geometry;
  width: number;
  height: number;
  frame: FrameSpec;
  layout: LayoutType;
  participantCount: number;
}

/**
 * Builds the two static layers of the live preview:
 *  - `paper`: opaque background decoration (gradients, texture, glow)
 *  - `overlay`: transparent slot hairlines + caption + watermark
 *
 * They are rendered once per frame/layout change; each animation frame only
 * composites the live video cells between them. That keeps the preview at
 * 60 fps while matching the export geometry exactly.
 */
export function buildStageLayers(options: {
  frame: FrameSpec;
  layout: LayoutType;
  participantCount: number;
  tier: Tier;
  watermark: boolean;
  roomCode: string;
  dateStamp: string;
  longEdge: number;
}): StageLayers {
  const geo = getGeometry(options.layout, options.participantCount, options.longEdge);
  const paper = makeCanvas(geo.width, geo.height);
  const overlay = makeCanvas(geo.width, geo.height);

  const paperCtx = paper.getContext("2d") as Canvas2D | null;
  const overlayCtx = overlay.getContext("2d") as Canvas2D | null;
  if (!paperCtx || !overlayCtx) throw new Error("Canvas 2D unavailable");

  paintPaper(paperCtx, geo, options.frame);

  const participants = Array.from({ length: options.participantCount }, (_, i) => `p${i}`);
  const shotCount = LAYOUT_SHOTS[options.layout];
  for (let shotIndex = 0; shotIndex < shotCount; shotIndex += 1) {
    withShotCells(overlayCtx, geo, options.frame, shotIndex, participants, () => {
      /* cells are painted live; only borders/clips go to the overlay */
    });
  }

  drawFrameOrnaments(overlayCtx, geo, options.frame, {
    roomCode: options.roomCode,
    dateStamp: options.dateStamp,
    tier: options.tier,
    watermark: options.watermark,
    participantCount: options.participantCount,
    layout: options.layout,
  });

  return {
    paper,
    overlay,
    geo,
    width: geo.width,
    height: geo.height,
    frame: options.frame,
    layout: options.layout,
    participantCount: options.participantCount,
  };
}

export interface CellFeed {
  image: CanvasImageSource;
  width: number;
  height: number;
  mirrored: boolean;
}

/** object-fit: cover, with optional horizontal mirror baked into the draw. */
function drawCoverInto(
  ctx: Canvas2D,
  feed: CellFeed,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!feed.width || !feed.height || w <= 0 || h <= 0) return;
  const targetAspect = w / h;
  const sourceAspect = feed.width / feed.height;
  let sw = feed.width;
  let sh = feed.height;
  if (sourceAspect > targetAspect) sw = feed.height * targetAspect;
  else sh = feed.width / targetAspect;
  const sx = (feed.width - sw) / 2;
  const sy = (feed.height - sh) / 2;

  ctx.save();
  if (feed.mirrored) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(feed.image, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    ctx.drawImage(feed.image, sx, sy, sw, sh, x, y, w, h);
  }
  ctx.restore();
}

export class StageRenderer {
  private scratch: HTMLCanvasElement | OffscreenCanvas;
  private scratchCtx: Canvas2D;

  constructor(
    private canvas: HTMLCanvasElement,
    private layers: StageLayers,
  ) {
    canvas.width = layers.width;
    canvas.height = layers.height;
    this.scratch = makeCanvas(layers.width, layers.height);
    this.scratchCtx = this.scratch.getContext("2d") as Canvas2D;
  }

  get geometry() {
    return this.layers.geo;
  }

  updateLayers(layers: StageLayers) {
    this.layers = layers;
    this.canvas.width = layers.width;
    this.canvas.height = layers.height;
    this.scratch = makeCanvas(layers.width, layers.height);
    this.scratchCtx = this.scratch.getContext("2d") as Canvas2D;
  }

  /**
   * Draws the live feeds repeated across every slot so the preview reads like
   * the finished strip while people are still posing.
   */
  draw(feeds: Array<CellFeed | null>) {
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height, geo, paper, overlay, frame, participantCount } = this.layers;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(paper as CanvasImageSource, 0, 0);

    const ids = Array.from({ length: participantCount }, (_, i) => `p${i}`);
    for (let shotIndex = 0; shotIndex < geo.shots.length; shotIndex += 1) {
      withShotCells(
        ctx as unknown as Canvas2D,
        geo,
        frame,
        shotIndex,
        ids,
        ({ cell, participantIndex }) => {
          const feed = feeds[participantIndex] ?? null;
          if (!feed) {
            const gradient = ctx.createLinearGradient(cell.x, cell.y, cell.x + cell.w, cell.y + cell.h);
            gradient.addColorStop(0, "rgba(255,255,255,0.07)");
            gradient.addColorStop(1, "rgba(255,255,255,0.02)");
            ctx.fillStyle = gradient;
            ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
            return;
          }
          this.scratchCtx.clearRect(0, 0, width, height);
          drawCoverInto(this.scratchCtx, feed, cell.x, cell.y, cell.w, cell.h);
          ctx.drawImage(
            this.scratch as CanvasImageSource,
            cell.x,
            cell.y,
            cell.w,
            cell.h,
            cell.x,
            cell.y,
            cell.w,
            cell.h,
          );
        },
      );
    }

    ctx.drawImage(overlay as CanvasImageSource, 0, 0);
  }
}
