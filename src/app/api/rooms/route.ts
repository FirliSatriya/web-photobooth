import { NextResponse } from "next/server";
import {
  createRoom,
  getRoom,
  incrementRetake,
  toPublicRoom,
  unlockRoom,
  updateRoom,
} from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const room = await createRoom();
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.json({
      room: toPublicRoom(room),
      hostToken: room.hostToken,
      shareUrl: `${origin}/room/${room.code}`,
      paymentProvider: process.env.MIDTRANS_SERVER_KEY ? "midtrans" : "demo",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ room: toPublicRoom(room) });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { code?: string; action?: string; tier?: string; frameId?: string; layout?: string }
    | null;
  if (!body?.code) return NextResponse.json({ error: "code required" }, { status: 400 });

  if (body.action === "unlock") {
    const room = await unlockRoom(body.code);
    if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ room: toPublicRoom(room) });
  }

  if (body.action === "retake") {
    const room = await incrementRetake(body.code);
    if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ room: toPublicRoom(room) });
  }

  if (body.action === "complete") {
    const room = await updateRoom(body.code, { status: "completed" });
    if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ room: toPublicRoom(room) });
  }

  if (body.action === "frame") {
    const room = await updateRoom(body.code, {
      selectedFrameId: body.frameId ?? null,
      ...(body.layout ? { layout: body.layout as never } : {}),
    });
    if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ room: toPublicRoom(room) });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
