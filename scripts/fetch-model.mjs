import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Downloads the Selfie Segmentation model used by the AI Studio Backdrop
 * (Pro tier). The file is too large to commit, so run this once:
 *   node scripts/fetch-model.mjs
 */
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const target = path.join(root, "public", "models", "selfie_segmenter.tflite");
const url =
  process.env.SELFIE_MODEL_URL ??
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite";

if (fs.existsSync(target) && fs.statSync(target).size > 100_000) {
  console.log("[model] selfie_segmenter.tflite already present");
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), { recursive: true });

const response = await fetch(url);
if (!response.ok) {
  console.error(`[model] download failed: HTTP ${response.status}`);
  process.exit(1);
}
const buffer = Buffer.from(await response.arrayBuffer());
fs.writeFileSync(target, buffer);
console.log(`[model] saved ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB to public/models`);
