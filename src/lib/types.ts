export type Tier = "free" | "paid";
export type LayoutType = "1x4_strip" | "2x2_grid" | "1x2_wide";
export type RoomStatus = "waiting" | "active" | "completed" | "expired";
export type FilterId = "none" | "mono" | "vintage" | "cinematic" | "dreamy" | "grain";

export const LAYOUTS: Array<{ id: LayoutType; label: string; hint: string; shots: number }> = [
  { id: "1x4_strip", label: "Strip 1×4", hint: "Empat bingkai klasik", shots: 4 },
  { id: "2x2_grid", label: "Grid 2×2", hint: "Empat potret kotak", shots: 4 },
  { id: "1x2_wide", label: "Wide 1×2", hint: "Dua potret lebar", shots: 2 },
];

export const TIER_LIMITS = {
  free: {
    durationMs: 10 * 60 * 1000,
    maxParticipants: 2,
    maxRetakes: 1,
    outputEdge: 1280,
    watermark: true,
    boomerang: false,
    backdrop: false,
    hd: false,
  },
  paid: {
    durationMs: 60 * 60 * 1000,
    maxParticipants: 4,
    maxRetakes: Number.POSITIVE_INFINITY,
    outputEdge: 2560,
    watermark: false,
    boomerang: true,
    backdrop: true,
    hd: true,
  },
} as const;

export function limitsFor(tier: Tier) {
  return tier === "paid" ? TIER_LIMITS.paid : TIER_LIMITS.free;
}

export interface PublicRoom {
  code: string;
  tier: Tier;
  layout: LayoutType;
  maxParticipants: number;
  maxRetakes: number;
  retakesUsed: number;
  status: RoomStatus;
  createdAt: string;
  expiresAt: string;
  selectedFrameId: string | null;
  isDemo: boolean;
}

export interface RoomCreateResponse {
  room: PublicRoom;
  hostToken: string;
  shareUrl: string;
  paymentProvider: "midtrans" | "demo";
}

export interface ShareOutput {
  token: string;
  imageUrl: string;
  videoUrl: string | null;
  expiresAt: string;
}

export interface PeerInfo {
  peerId: string;
  name: string;
  isHost: boolean;
  mirrored: boolean;
  joinedAt: number;
}

export interface Hit {
  peerId: string;
  shotIndex: number;
  blob: Blob;
  width: number;
  height: number;
}

export type SignalMessage =
  | { t: "hello"; peer: PeerInfo }
  | { t: "welcome"; peer: PeerInfo }
  | { t: "presence"; peers: PeerInfo[]; hostId: string | null }
  | { t: "peer-joined"; peer: PeerInfo }
  | { t: "peer-left"; peerId: string }
  | { t: "full"; to: string; capacity: number }
  | { t: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { t: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { t: "ice"; from: string; to: string; candidate: RTCIceCandidateInit | null }
  | { t: "ping"; from: string; to: string; id: string; sentAt: number }
  | { t: "pong"; from: string; to: string; id: string; sentAt: number; receivedAt: number }
  | { t: "mirror"; peerId: string; mirrored: boolean }
  | { t: "rename"; peerId: string; name: string }
  | { t: "timer"; shotIndex: number; targetHostTs: number; countdownMs: number; isRetake: boolean }
  | { t: "shot-ready"; shotIndex: number; by: string }
  | { t: "tier"; tier: Tier; maxParticipants: number; maxRetakes: number; expiresAt: string }
  | { t: "frame"; frameId: string; layout: LayoutType; filter: FilterId }
  | { t: "backdrop"; enabled: boolean }
  | { t: "result"; token: string; shareUrl: string; imageUrl: string; videoUrl: string | null; expiresAt: string }
  | { t: "status"; status: RoomStatus }
  | { t: "finish" }
  | { t: "bye"; peerId: string };
