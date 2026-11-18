import { NextResponse } from "next/server";
import { getAdminClient, getRoom, saveOutput } from "@/lib/server/store";
import { storeObject } from "@/lib/server/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

function newToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  }
  return Math.random().toString(36).slice(2, 26);
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const code = String(form.get("code") ?? "");
  const image = form.get("image");
  const video = form.get("video");

  if (!code || !(image instanceof File)) {
    return NextResponse.json({ error: "code and image are required" }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "image too large" }, { status: 413 });
  }
  if (video instanceof File && video.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "video too large" }, { status: 413 });
  }

  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "room not found" }, { status: 404 });

  const token = newToken();
  const imageBytes = new Uint8Array(await image.arrayBuffer());
  const videoBytes = video instanceof File ? new Uint8Array(await video.arrayBuffer()) : null;
  const imageType = image.type || "image/png";
  const videoType = video instanceof File ? video.type || "video/mp4" : null;

  // Push to Cloudflare R2 / Supabase Storage when configured. Both have a 24h
  // lifecycle rule, so nothing outlives its share link.
  const [imageStored, videoStored] = await Promise.all([
    storeObject(`outputs/${code}/${token}.png`, imageBytes, imageType),
    videoBytes
      ? storeObject(`outputs/${code}/${token}.mp4`, videoBytes, videoType ?? "video/mp4")
      : Promise.resolve(null),
  ]);

  const imageUrl = imageStored?.url ?? `/api/output/${token}?asset=image`;
  const videoUrl = videoStored?.url ?? (videoBytes ? `/api/output/${token}?asset=video` : null);
  const keepLocal = !imageStored;

  const record = saveOutput({
    roomCode: code,
    token,
    image: keepLocal ? imageBytes : null,
    imageType,
    imageUrl,
    video: keepLocal ? videoBytes : null,
    videoType,
    videoUrl,
  });

  const admin = getAdminClient();
  if (admin) {
    const { error } = await admin.from("photo_outputs").insert({
      room_id: null,
      final_image_url: imageUrl,
      boomerang_video_url: videoUrl,
      share_token: record.token,
      delete_after: new Date(record.expiresAt).toISOString(),
    });
    // The rooms table uses a UUID primary key; when the API-only demo room has
    // no DB row this insert would fail on the FK, which is safe to ignore.
    if (error && !/foreign key|violates/i.test(error.message)) {
      console.warn("[output] photo_outputs insert failed:", error.message);
    }
  }

  return NextResponse.json({
    token: record.token,
    imageUrl,
    videoUrl,
    expiresAt: new Date(record.expiresAt).toISOString(),
    storage: imageStored ? "object-storage" : "memory",
  });
}
