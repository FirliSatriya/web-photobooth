import { NextResponse } from "next/server";
import { getOutput } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const record = getOutput(token);
  if (!record) {
    return NextResponse.json({ error: "expired" }, { status: 404 });
  }
  return NextResponse.json({
    token: record.token,
    imageUrl: record.imageUrl,
    videoUrl: record.videoUrl,
    roomCode: record.roomCode,
    expiresAt: new Date(record.expiresAt).toISOString(),
    createdAt: new Date(record.createdAt).toISOString(),
  });
}
