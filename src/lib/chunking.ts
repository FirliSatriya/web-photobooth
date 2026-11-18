/**
 * RTCDataChannel payloads larger than the negotiated max message size are
 * unreliable across browsers. Photos are therefore split into chunks with a
 * small JSON header describing the transfer.
 *
 * Wire format: JSON header + "\n" + raw bytes
 */
export const CHUNK_SIZE = 48 * 1024; // 48 KB, inside the 16–64 KB window

export interface ChunkHeader {
  t: "chunk";
  id: string;
  shotIndex: number;
  participantId: string;
  seq: number;
  total: number;
  mime: string;
  width: number;
  height: number;
  bytes: number;
}

export interface ChunkedBlob {
  id: string;
  shotIndex: number;
  participantId: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  total: number;
  parts: Uint8Array[];
  received: number;
  createdAt: number;
}

export function splitChunks(
  blob: Blob,
  meta: { id: string; shotIndex: number; participantId: string; width: number; height: number },
  buffer: ArrayBuffer,
): ArrayBuffer[] {
  const bytes = new Uint8Array(buffer);
  const total = Math.ceil(bytes.byteLength / CHUNK_SIZE) || 1;
  const packets: ArrayBuffer[] = [];
  const encoder = new TextEncoder();

  for (let seq = 0; seq < total; seq += 1) {
    const start = seq * CHUNK_SIZE;
    const end = Math.min(bytes.byteLength, start + CHUNK_SIZE);
    const slice = bytes.subarray(start, end);

    const header: ChunkHeader = {
      t: "chunk",
      id: meta.id,
      shotIndex: meta.shotIndex,
      participantId: meta.participantId,
      seq,
      total,
      mime: blob.type || "image/webp",
      width: meta.width,
      height: meta.height,
      bytes: bytes.byteLength,
    };

    const headerBytes = encoder.encode(`${JSON.stringify(header)}\n`);
    const packet = new Uint8Array(headerBytes.byteLength + slice.byteLength);
    packet.set(headerBytes, 0);
    packet.set(slice, headerBytes.byteLength);
    packets.push(packet.buffer);
  }
  return packets;
}

export class ChunkAssembler {
  private transfers = new Map<string, ChunkedBlob>();
  private ttl = 60_000;

  get pendingCount() {
    return this.transfers.size;
  }

  push(packet: ArrayBuffer): { done: false } | { done: true; blob: ChunkedBlob } {
    const bytes = new Uint8Array(packet);
    const newline = bytes.indexOf(10);
    if (newline < 0) return { done: false };

    let header: ChunkHeader;
    try {
      header = JSON.parse(new TextDecoder().decode(bytes.subarray(0, newline))) as ChunkHeader;
    } catch {
      return { done: false };
    }
    if (header.t !== "chunk") return { done: false };

    let transfer = this.transfers.get(header.id);
    if (!transfer) {
      transfer = {
        id: header.id,
        shotIndex: header.shotIndex,
        participantId: header.participantId,
        mime: header.mime,
        width: header.width,
        height: header.height,
        bytes: header.bytes,
        total: header.total,
        parts: new Array(header.total),
        received: 0,
        createdAt: Date.now(),
      };
      this.transfers.set(header.id, transfer);
    }

    if (!transfer.parts[header.seq]) {
      transfer.parts[header.seq] = bytes.slice(newline + 1);
      transfer.received += 1;
    }

    if (transfer.received < transfer.total) {
      this.gc();
      return { done: false };
    }

    this.transfers.delete(header.id);
    return { done: true, blob: transfer };
  }

  assemble(transfer: ChunkedBlob): Blob {
    return new Blob(transfer.parts as BlobPart[], { type: transfer.mime });
  }

  private gc() {
    const now = Date.now();
    for (const [id, transfer] of this.transfers) {
      if (now - transfer.createdAt > this.ttl) this.transfers.delete(id);
    }
  }

  clear() {
    this.transfers.clear();
  }
}

export function bufferFromBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsArrayBuffer(blob);
  });
}
