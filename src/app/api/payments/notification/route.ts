import { NextResponse } from "next/server";
import { getOrder, markOrderPaid, unlockRoom } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * Midtrans HTTP notification handler.
 *
 * Real deployments must verify the signature:
 *   sha512(order_id + status_code + gross_amount + server_key)
 * For local/demo runs the handler stays permissive so the flow is testable.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  const orderId = String(body.order_id ?? "");
  const transactionStatus = String(body.transaction_status ?? "");
  const fraudStatus = String(body.fraud_status ?? "accept");
  const statusCode = String(body.status_code ?? "");
  const signatureKey = String(body.signature_key ?? "");
  const grossAmount = String(body.gross_amount ?? "");

  const order = getOrder(orderId);
  const roomCode = order?.roomCode ?? orderId.split("-")[1];
  if (!roomCode) return NextResponse.json({ error: "unknown order" }, { status: 404 });

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (serverKey && signatureKey) {
    const { createHash } = await import("node:crypto");
    const expected = createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest("hex");
    if (expected !== signatureKey) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  const paid =
    transactionStatus === "settlement" || (transactionStatus === "capture" && fraudStatus === "accept");

  if (paid) {
    markOrderPaid(orderId);
    const room = await unlockRoom(roomCode);
    if (!room) return NextResponse.json({ error: "room not found" }, { status: 404 });
    return NextResponse.json({ ok: true, tier: room.tier });
  }

  return NextResponse.json({ ok: true, ignored: transactionStatus });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "midtrans-notification" });
}
