import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LayoutType, PublicRoom, RoomStatus, Tier } from "../types";

export interface RoomRecord extends PublicRoom {
  hostToken: string;
  updatedAt: string;
}

export interface OutputRecord {
  token: string;
  roomCode: string;
  imageUrl: string;
  videoUrl: string | null;
  image: Uint8Array | null;
  imageType: string;
  video: Uint8Array | null;
  videoType: string | null;
  createdAt: number;
  expiresAt: number;
}

interface OrderRecord {
  roomCode: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "expired";
  provider: "midtrans" | "demo";
  createdAt: number;
}

interface GlobalState {
  __pbRooms?: Map<string, RoomRecord>;
  __pbOutputs?: Map<string, OutputRecord>;
  __pbOrders?: Map<string, OrderRecord>;
}

const globalState = globalThis as unknown as GlobalState;
const rooms = (globalState.__pbRooms ??= new Map());
const outputs = (globalState.__pbOutputs ??= new Map());
const orders = (globalState.__pbOrders ??= new Map());

const ROOM_TTL_MS = 15 * 60 * 1000;
const OUTPUT_TTL_MS = 24 * 60 * 60 * 1000;

export function hasSupabaseAdmin(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let adminClient: SupabaseClient | null = null;
export function getAdminClient(): SupabaseClient | null {
  if (!hasSupabaseAdmin()) return null;
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return adminClient;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function rowToRecord(row: Record<string, unknown>): RoomRecord {
  return {
    code: String(row.room_code),
    tier: (row.tier as Tier) ?? "free",
    layout: (row.layout_type as LayoutType) ?? "1x4_strip",
    maxParticipants: Number(row.max_participants ?? 2),
    maxRetakes: Number(row.max_retakes ?? 1),
    retakesUsed: Number(row.retakes_used ?? 0),
    status: (row.status as RoomStatus) ?? "waiting",
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    selectedFrameId: (row.selected_frame_slug as string | null) ?? null,
    isDemo: false,
    hostToken: String(row.host_session_token),
    updatedAt: String(row.created_at),
  };
}

export async function createRoom(): Promise<RoomRecord> {
  const now = Date.now();
  const expiresAt = new Date(now + ROOM_TTL_MS).toISOString();
  const hostToken =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${now}-${Math.random().toString(36).slice(2)}`;

  const admin = getAdminClient();
  if (admin) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const code = generateCode();
      const { data, error } = await admin
        .from("rooms")
        .insert({
          room_code: code,
          host_session_token: hostToken,
          tier: "free",
          max_participants: 2,
          max_retakes: 1,
          status: "waiting",
          expires_at: expiresAt,
        })
        .select("*")
        .single();
      if (!error && data) return rowToRecord(data as Record<string, unknown>);
      if (error && !/duplicate|unique/i.test(error.message)) {
        throw new Error(`Gagal membuat ruang: ${error.message}`);
      }
    }
    throw new Error("Gagal membuat kode ruang unik, coba lagi.");
  }

  let code = generateCode();
  while (rooms.has(code)) code = generateCode();
  const record: RoomRecord = {
    code,
    tier: "free",
    layout: "1x4_strip",
    maxParticipants: 2,
    maxRetakes: 1,
    retakesUsed: 0,
    status: "waiting",
    createdAt: new Date(now).toISOString(),
    expiresAt,
    selectedFrameId: null,
    isDemo: true,
    hostToken,
    updatedAt: new Date(now).toISOString(),
  };
  rooms.set(code, record);
  return record;
}

export async function getRoom(code: string): Promise<RoomRecord | null> {
  const admin = getAdminClient();
  if (admin) {
    const { data, error } = await admin.from("rooms").select("*").eq("room_code", code).maybeSingle();
    if (error || !data) return null;
    return rowToRecord(data as Record<string, unknown>);
  }
  const room = rooms.get(code);
  if (!room) return null;
  if (Date.now() > Date.parse(room.expiresAt) && room.status !== "completed") {
    room.status = "expired";
  }
  return room;
}

export async function updateRoom(code: string, patch: Partial<RoomRecord>): Promise<RoomRecord | null> {
  const admin = getAdminClient();
  const dbPatch: Record<string, unknown> = {};
  if (patch.tier) dbPatch.tier = patch.tier;
  if (patch.layout) dbPatch.layout_type = patch.layout;
  if (patch.maxParticipants !== undefined) dbPatch.max_participants = patch.maxParticipants;
  if (patch.maxRetakes !== undefined) dbPatch.max_retakes = patch.maxRetakes;
  if (patch.retakesUsed !== undefined) dbPatch.retakes_used = patch.retakesUsed;
  if (patch.status) dbPatch.status = patch.status;
  if (patch.expiresAt) dbPatch.expires_at = patch.expiresAt;
  if (patch.selectedFrameId !== undefined) dbPatch.selected_frame_slug = patch.selectedFrameId;

  if (admin) {
    const { data, error } = await admin.from("rooms").update(dbPatch).eq("room_code", code).select("*").maybeSingle();
    if (error || !data) return null;
    return rowToRecord(data as Record<string, unknown>);
  }

  const room = rooms.get(code);
  if (!room) return null;
  Object.assign(room, patch, { updatedAt: new Date().toISOString() });
  rooms.set(code, room);
  return room;
}

export function toPublicRoom(room: RoomRecord): PublicRoom {
  return {
    code: room.code,
    tier: room.tier,
    layout: room.layout,
    maxParticipants: room.maxParticipants,
    maxRetakes: room.maxRetakes,
    retakesUsed: room.retakesUsed,
    status: room.status,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    selectedFrameId: room.selectedFrameId,
    isDemo: room.isDemo,
  };
}

export async function unlockRoom(code: string): Promise<RoomRecord | null> {
  const room = await getRoom(code);
  if (!room) return null;
  if (room.tier === "paid") return room;
  return updateRoom(code, {
    tier: "paid",
    maxParticipants: 4,
    maxRetakes: 9999,
    expiresAt: new Date(Math.max(Date.parse(room.expiresAt), Date.now() + 60 * 60 * 1000)).toISOString(),
  });
}

export async function incrementRetake(code: string): Promise<RoomRecord | null> {
  const room = await getRoom(code);
  if (!room) return null;
  if (room.retakesUsed >= room.maxRetakes) return room;
  return updateRoom(code, { retakesUsed: room.retakesUsed + 1 });
}

export function saveOutput(input: {
  roomCode: string;
  image: Uint8Array | null;
  imageType: string;
  imageUrl: string;
  video: Uint8Array | null;
  videoType: string | null;
  videoUrl: string | null;
  token?: string;
}): OutputRecord {
  const token =
    input.token ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 24)
      : Math.random().toString(36).slice(2, 26));
  const record: OutputRecord = {
    token,
    roomCode: input.roomCode,
    imageUrl: input.imageUrl,
    videoUrl: input.videoUrl,
    image: input.image,
    imageType: input.imageType,
    video: input.video,
    videoType: input.videoType,
    createdAt: Date.now(),
    expiresAt: Date.now() + OUTPUT_TTL_MS,
  };
  outputs.set(token, record);
  pruneOutputs();
  return record;
}

export function getOutput(token: string): OutputRecord | null {
  pruneOutputs();
  const record = outputs.get(token);
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    outputs.delete(token);
    return null;
  }
  return record;
}

/**
 * Same as `getOutput`, but falls back to the `photo_outputs` table so a share
 * link keeps working after a serverless cold start (in-memory map is empty).
 */
export async function getOutputRecord(token: string): Promise<OutputRecord | null> {
  const local = getOutput(token);
  if (local) return local;

  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("photo_outputs")
    .select("share_token, final_image_url, boomerang_video_url, delete_after, created_at")
    .eq("share_token", token)
    .maybeSingle();
  if (error || !data) return null;

  const expiresAt = Date.parse(String(data.delete_after));
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) return null;
  const createdAt = Date.parse(String(data.created_at ?? ""));

  return {
    token,
    roomCode: "",
    imageUrl: String(data.final_image_url),
    videoUrl: (data.boomerang_video_url as string | null) ?? null,
    image: null,
    imageType: "image/png",
    video: null,
    videoType: null,
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    expiresAt,
  };
}

function pruneOutputs() {
  const now = Date.now();
  for (const [token, record] of outputs) {
    if (now > record.expiresAt) outputs.delete(token);
  }
}

export function trackOrder(orderId: string, record: Omit<OrderRecord, "createdAt">) {
  orders.set(orderId, { ...record, createdAt: Date.now() });
}

export function getOrder(orderId: string): OrderRecord | null {
  return orders.get(orderId) ?? null;
}

export function markOrderPaid(orderId: string) {
  const order = orders.get(orderId);
  if (!order) return null;
  order.status = "paid";
  return order;
}
