/**
 * Small text protocol that rides on the same RTCDataChannel as the binary
 * photo chunks. Binary packets are described in `chunking.ts` (JSON header +
 * "\n" + bytes); text packets are plain JSON with a `t` discriminator.
 */
export type DataText =
  | { t: "ping"; id: string; sentAt: number }
  | { t: "pong"; id: string; sentAt: number; receivedAt: number }
  | { t: "ready"; at: number }
  | { t: "shot-done"; shotIndex: number };

export function parseDataText(value: string): DataText | null {
  try {
    const parsed = JSON.parse(value) as DataText;
    if (!parsed || typeof parsed !== "object" || typeof (parsed as { t?: unknown }).t !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function encodeDataText(message: DataText): string {
  return JSON.stringify(message);
}
