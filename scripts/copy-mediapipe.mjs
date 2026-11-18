import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copies the MediaPipe vision WASM runtime into /public so it can be served by
 * Next.js without a CDN dependency. Runs automatically on `npm install`.
 */
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const target = path.join(root, "public", "mediapipe", "wasm");

if (!fs.existsSync(source)) {
  console.log("[mediapipe] tasks-vision not installed, skipping wasm copy");
  process.exit(0);
}

fs.mkdirSync(target, { recursive: true });
for (const file of fs.readdirSync(source)) {
  if (!file.endsWith(".wasm") && !file.endsWith(".js")) continue;
  fs.copyFileSync(path.join(source, file), path.join(target, file));
}
console.log(`[mediapipe] wasm runtime copied to ${path.relative(root, target)}`);
