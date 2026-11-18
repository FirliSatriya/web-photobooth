import { getOutput } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const asset = new URL(request.url).searchParams.get("asset") ?? "image";
  const record = getOutput(token);
  if (!record) {
    return new Response("Hasil foto sudah kedaluwarsa atau tidak ditemukan.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Object storage configured: redirect to the durable URL instead of proxying.
  const hosted = asset === "video" ? record.videoUrl : record.imageUrl;
  const bytes = asset === "video" ? record.video : record.image;
  if (!bytes) {
    if (hosted && !hosted.startsWith("/api/")) {
      return Response.redirect(hosted, 302);
    }
    return new Response("Aset tidak tersedia.", { status: 404 });
  }

  const type = asset === "video" ? record.videoType ?? "video/mp4" : record.imageType;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="photobooth-${token}.${asset === "video" ? "mp4" : "png"}"`,
    },
  });
}
