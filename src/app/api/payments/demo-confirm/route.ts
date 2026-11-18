import { NextResponse } from "next/server";
import { getRoom, updateRoom } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * Demo-only confirm endpoint. Mirrors what the Midtrans webhook does, but is
 * gated so it can never unlock a room when real gateway keys are configured.
 */
export async function POST(request: Request) {
  if (process.env.MIDTRANS_SERVER_KEY) {
    return NextResponse.json({ error: "disabled" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  if (!body?.code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const room = await getRoom(body.code);
  if (!room) return NextResponse.json({ error: "room not found" }, { status: 404 });

  const updated = await updateRoom(body.code, {
    tier: "paid",
    maxParticipants: 4,
    maxRetakes: 9999,
    expiresAt: new Date(Math.max(Date.parse(room.expiresAt), Date.now() + 60 * 60 * 1000)).toISOString(),
  });
  return NextResponse.json({ ok: true, room: updated });
}
