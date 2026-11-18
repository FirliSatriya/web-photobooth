import type { Metadata } from "next";
import { Booth } from "@/components/booth/Booth";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Ruang ${code} — Remote Photobooth`,
    description: "Bilik photobooth virtual: cek kamera, pilih frame, lalu jepret bareng.",
    robots: { index: false, follow: false },
  };
}

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Booth code={code} />;
}
