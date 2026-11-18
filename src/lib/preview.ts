import type { FrameSpec } from "./frames";
import { LAYOUT_SHOTS, getGeometry } from "./layout";
import { drawFrameOrnaments, makeCanvas, paintPaper, withShotCells, type Canvas2D } from "./compose";
import type { LayoutType } from "./types";

/**
 * Static placeholder strip, used by the landing page and the frame picker.
 * It runs the *same* paper/ornament pipeline as the real export so what you
 * pick is what you get.
 */
export function renderPlaceholderStrip(
  canvas: HTMLCanvasElement,
  frame: FrameSpec,
  options: { participantCount?: number; longEdge?: number; roomCode?: string; dateStamp?: string } = {},
) {
  const participantCount = options.participantCount ?? 2;
  const geo = getGeometry(frame.layout as LayoutType, participantCount, options.longEdge ?? 900);
  canvas.width = geo.width;
  canvas.height = geo.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  paint(ctx, geo, frame, participantCount, options);
}

function paint(
  ctx: CanvasRenderingContext2D,
  geo: ReturnType<typeof getGeometry>,
  frame: FrameSpec,
  participantCount: number,
  options: { roomCode?: string; dateStamp?: string },
) {
  const surface = ctx as unknown as Canvas2D;
  paintPaper(surface, geo, frame);

  const shotCount = LAYOUT_SHOTS[frame.layout];
  for (let shotIndex = 0; shotIndex < shotCount; shotIndex += 1) {
    withShotCells(
      ctx as unknown as Canvas2D,
      geo,
      frame,
      shotIndex,
      Array.from({ length: participantCount }, (_, i) => `p${i}`),
      ({ cell, participantIndex, shotIndex: si }) => {
        const tintA = frame.style === "neon" ? frame.secondary : frame.ink;
        const tintB = frame.style === "neon" ? frame.accent : frame.accent;
        const gradient = ctx.createLinearGradient(cell.x, cell.y, cell.x + cell.w, cell.y + cell.h);
        gradient.addColorStop(0, `${tintA}44`);
        gradient.addColorStop(0.55, `${tintB}33`);
        gradient.addColorStop(1, `${tintA}22`);
        ctx.fillStyle = gradient;
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h);

        // abstract subject silhouettes so the composition reads clearly
        const unit = geo.longEdge / 1000;
        const cx = cell.x + cell.w * (participantIndex % 2 === 0 ? 0.42 : 0.58);
        const headR = Math.min(cell.w, cell.h) * 0.15;
        const headY = cell.y + cell.h * (si % 2 === 0 ? 0.42 : 0.46);
        ctx.fillStyle = `${frame.ink}33`;
        ctx.beginPath();
        ctx.arc(cx, headY, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx, headY + headR * 2.1, headR * 1.75, headR * 1.5, 0, Math.PI, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `${frame.paper}55`;
        ctx.font = `${Math.max(9, 12 * unit)}px system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText(`0${shotIndex + 1}`, cell.x + 10 * unit, cell.y + 20 * unit);
        ctx.textAlign = "left";
      },
    );
  }

  drawFrameOrnaments(ctx as unknown as Canvas2D, geo, frame, {
    roomCode: options.roomCode ?? "240816",
    dateStamp: options.dateStamp ?? "26.11.18",
    tier: frame.isPremium ? "paid" : "free",
    watermark: !frame.isPremium,
    participantCount,
    layout: frame.layout,
  });
}

export function placeholderBlob(
  frame: FrameSpec,
  options: { participantCount?: number; longEdge?: number } = {},
): Promise<Blob> {
  const canvas = makeCanvas(900, 1200) as HTMLCanvasElement;
  renderPlaceholderStrip(canvas, frame, options);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/png");
  });
}
