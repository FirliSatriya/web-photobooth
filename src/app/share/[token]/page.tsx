import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Lock, Sparkles } from "lucide-react";
import { Button, Logo, Pill } from "@/components/ui";
import { QRCode } from "@/components/booth/QRCode";
import { ShareActions } from "@/components/booth/ShareActions";
import { getOutputRecord } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const record = await getOutputRecord(token);
  if (!record) {
    return { title: "Tautan sudah kedaluwarsa — Remote Photobooth", robots: { index: false, follow: false } };
  }
  const absolute = (url: string) => (/^https?:\/\//i.test(url) ? url : `${APP_URL}${url}`);
  return {
    title: "Photostrip dari Remote Photobooth",
    description: "Foto bareng walau beda kota. Tautan ini aktif selama 24 jam.",
    openGraph: {
      title: "Photostrip dari Remote Photobooth",
      description: "Foto bareng walau beda kota.",
      images: [{ url: absolute(record.imageUrl) }],
      type: "website",
    },
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const record = await getOutputRecord(token);

  if (!record) {
    return (
      <main className="relative flex min-h-dvh flex-col">
        <div className="page-glow pointer-events-none absolute inset-0" aria-hidden />
        <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/">
            <Logo />
          </Link>
        </header>
        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 pb-20 text-center">
          <Lock className="h-6 w-6 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Tautan sudah kedaluwarsa</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Semua hasil disimpan maksimal 24 jam lalu dihapus otomatis. Minta host membuat sesi baru untuk
            photostrip berikutnya.
          </p>
          <Link href="/create" className="mt-2">
            <Button size="lg">Buat ruang baru</Button>
          </Link>
        </div>
      </main>
    );
  }

  const absolute = (url: string) => (/^https?:\/\//i.test(url) ? url : `${APP_URL}${url}`);
  const imageUrl = absolute(record.imageUrl);
  const videoUrl = record.videoUrl ? absolute(record.videoUrl) : null;
  const pageUrl = `${APP_URL}/share/${token}`;
  const expires = new Date(record.expiresAt);
  const hoursLeft = Math.max(0, Math.round((record.expiresAt - Date.now()) / 3600000));

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="page-glow pointer-events-none absolute inset-0" aria-hidden />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/">
          <Logo />
        </Link>
        <Pill tone="live">
          <Clock className="h-3 w-3" /> {hoursLeft > 0 ? `${hoursLeft} jam lagi` : "segera berakhir"}
        </Pill>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-5xl items-start gap-5 px-5 pb-16 sm:px-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="surface min-w-0 rounded-3xl p-3 sm:p-4">
          <div className="overflow-hidden rounded-2xl border border-border/40 bg-card p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Photostrip hasil sesi"
              className="mx-auto max-h-[76vh] w-auto max-w-full object-contain"
            />
          </div>
          {videoUrl ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-border/40 bg-neutral-950">
              <video src={videoUrl} controls loop playsInline className="max-h-72 w-full" />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="surface rounded-3xl p-5">
            <Pill>
              <Sparkles className="h-3 w-3" /> Hasil sesi
            </Pill>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Photostrip kamu</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Simpan sekarang — tautan ini hilang otomatis pada{" "}
              {expires.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}.
            </p>

            <div className="mt-5">
              <ShareActions
                shareUrl={pageUrl}
                imageUrl={imageUrl}
                videoUrl={videoUrl}
                filename={`photobooth-${record.token.slice(0, 6)}`}
              />
            </div>
          </div>

          <div className="surface rounded-3xl p-5">
            <h2 className="text-sm font-medium">Buka di ponsel</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Pindai untuk menyimpan langsung ke galeri HP.</p>
            <QRCode value={pageUrl} size={176} className="mt-4" />
          </div>

          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            Privasi: server hanya menyimpan hasil akhir, bukan rekaman kamera. Objek dihapus otomatis lewat lifecycle
            rule 24 jam.
          </p>
        </div>
      </section>
    </main>
  );
}
