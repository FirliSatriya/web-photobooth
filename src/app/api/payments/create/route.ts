import { NextResponse } from "next/server";
import { getRoom, trackOrder } from "@/lib/server/store";
import { SESSION_PASS_PRICE } from "@/lib/pricing";

export const dynamic = "force-dynamic";

interface SnapResponse {
  token?: string;
  redirect_url?: string;
  error_messages?: string[];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  if (!body?.code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const room = await getRoom(body.code);
  if (!room) return NextResponse.json({ error: "room not found" }, { status: 404 });
  if (room.tier === "paid") {
    return NextResponse.json({ alreadyPaid: true, room });
  }

  const orderId = `PB-${body.code}-${Date.now()}`;
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  if (!serverKey) {
    // Demo mode: no gateway configured, unlock immediately so the paid flow can
    // be exercised locally. Never active when MIDTRANS_SERVER_KEY is present.
    trackOrder(orderId, { roomCode: body.code, amount: SESSION_PASS_PRICE, status: "paid", provider: "demo" });
    return NextResponse.json({
      demo: true,
      orderId,
      amount: SESSION_PASS_PRICE,
      provider: "demo",
    });
  }

  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const endpoint = isProduction
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: orderId,
          gross_amount: SESSION_PASS_PRICE,
        },
        item_details: [
          { id: "session-pass", price: SESSION_PASS_PRICE, quantity: 1, name: "Photobooth Session Pass" },
        ],
        callbacks: { finish: `${appUrl}/room/${body.code}?paid=1` },
        expiry: { unit: "minutes", duration: 15 },
      }),
    });

    const data = (await response.json().catch(() => ({}))) as SnapResponse;
    if (!response.ok || !data.token) {
      return NextResponse.json(
        { error: data.error_messages?.join(", ") ?? "Gagal membuat transaksi Midtrans" },
        { status: 502 },
      );
    }

    trackOrder(orderId, { roomCode: body.code, amount: SESSION_PASS_PRICE, status: "pending", provider: "midtrans" });
    return NextResponse.json({
      orderId,
      token: data.token,
      redirectUrl: data.redirect_url,
      amount: SESSION_PASS_PRICE,
      provider: "midtrans",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ error: `Midtrans error: ${message}` }, { status: 502 });
  }
}
