/** IndexedDB persistence for captured raw frames (host side). */

const DB_NAME = "photobooth";
const DB_VERSION = 1;
const STORE = "raw-shots";

export interface RawShot {
  key: string;
  roomCode: string;
  shotIndex: number;
  participantId: string;
  blob: Blob;
  width: number;
  height: number;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("room", "roomCode");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
  });
}

export async function putRawShot(shot: RawShot): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(shot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to persist shot"));
  });
  db.close();
}

export async function getRawShots(roomCode: string): Promise<RawShot[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  const shots = await new Promise<RawShot[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("room");
    const request = index.getAll(roomCode);
    request.onsuccess = () => resolve(request.result as RawShot[]);
    request.onerror = () => reject(request.error ?? new Error("Failed to read shots"));
  });
  db.close();
  return shots;
}

export async function clearRawShots(roomCode: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  const shots = await getRawShots(roomCode);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const shot of shots) store.delete(shot.key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to clear shots"));
  });
  db.close();
}

/** Drops everything except the current room (24h privacy hygiene). */
export async function pruneOldShots(currentRoom: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.openCursor();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const value = cursor.value as RawShot;
      if (value.roomCode !== currentRoom || value.savedAt < cutoff) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}
