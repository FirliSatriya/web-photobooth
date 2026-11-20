import Link from "next/link";
import { Apple, ArrowUpRight, Camera, Gauge, Layers, QrCode, Sparkles, Users, Wifi } from "lucide-react";
import { Button, Logo, Pill } from "@/components/ui";
import { HomeHero } from "@/components/home/HomeHero";
import { FrameGallery } from "@/components/home/FrameGallery";

const features = [
  {
    icon: Camera,
    title: "Dual-stream capture",
    body: "Pratinjau video ringan untuk pose, tapi jepretan diambil dari kamera lokal resolusi penuh — bukan screenshot WebRTC yang blur.",
  },
  {
    icon: Gauge,
    title: "Sinkron < 50 ms",
    body: "Clock calibration PING–PONG plus countdown bertimestamp membuat semua perangkat menjepret di frame yang sama.",
  },
  {
    icon: Layers,
    title: "Compositing GPU",
    body: "OffscreenCanvas di Web Worker merakit strip, filter WebGL2, dan bingkai tanpa membuat UI nge-freeze.",
  },
  {
    icon: Wifi,
    title: "Tetap jalan di jaringan ketat",
    body: "WebRTC P2P dengan STUN/TURN, foto dikirim via DataChannel chunking 48 KB anti-fragmentasi.",
  },
];

const steps = [
  { n: "01", t: "Buat ruang", d: "Tanpa login. Dapat tautan + kode 6 digit untuk dibagikan." },
  { n: "02", t: "Cek kamera", d: "Pilih webcam eksternal, tes framing, atur mirror masing-masing." },
  { n: "03", t: "Jepret bareng", d: "Countdown serentak, 2–4 slot foto sesuai layout." },
  { n: "04", t: "Unduh & bagikan", d: "PNG resolusi tinggi, MP4 boomerang, atau scan QR ke ponsel." },
];

const freePlan = [
  "Sesi maksimal 10 menit",
  "2 peserta (1-on-1)",
  "Foto HD 720p + watermark kecil",
  "5 frame dasar, 3 filter",
  "Retake maksimal 1x",
];

const passPlan = [
  "Sesi hingga 60 menit",
  "Hingga 4 peserta dalam 1 frame",
  "Ultra HD 1080p / 2K tanpa watermark",
  "Semua frame premium + upload custom",
  "Boomerang MP4 & AI Studio Backdrop",
  "Retake tanpa batas",
];

export default function HomePage() {
  return (
    <main className="relative isolate overflow-x-clip">
      <a
        href="#cara-kerja"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Lompat ke konten
      </a>

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-6 sm:px-8">
        <Logo />
        <nav aria-label="Navigasi utama" className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
          {[
            ["#cara-kerja", "Cara kerja"],
            ["#frame", "Frame"],
            ["#harga", "Harga"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 font-medium transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/join" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Gabung ruang
            </Button>
          </Link>
          <Link href="/create">
            <Button size="sm">
              Mulai sesi
              <ArrowUpRight className="size-4" aria-hidden />
            </Button>
          </Link>
        </div>
      </header>

      <HomeHero />

      <section id="cara-kerja" className="relative z-10 mx-auto w-full max-w-7xl scroll-mt-8 px-5 py-20 sm:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Pill tone="live">
              <Sparkles aria-hidden /> Cara kerja
            </Pill>
            <h2 className="mt-4 max-w-xl text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              Empat langkah dari ruang kosong ke photostrip.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Tidak ada aplikasi yang perlu diinstal. Semua pemrosesan berat berjalan di perangkat kamu
            sendiri, jadi hasil keluar dalam hitungan detik.
          </p>
        </div>

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li
              key={step.n}
              className="surface group relative overflow-hidden rounded-3xl p-6 transition-colors hover:border-primary/40"
            >
              <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-primary">{step.n}</span>
              <h3 className="mt-3 text-lg font-bold tracking-tight">{step.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.d}</p>
              <div className="mt-6 h-px w-full bg-gradient-to-r from-border to-transparent" />
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Keunggulan teknis" className="relative z-10 mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
        <ul className="grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <li key={feature.title} className="surface rounded-3xl p-6 sm:p-7">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-bold tracking-tight">{feature.title}</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <FrameGallery />

      <section id="harga" className="relative z-10 mx-auto w-full max-w-7xl scroll-mt-8 px-5 py-20 sm:px-8">
        <div className="mb-10 max-w-xl">
          <Pill>Harga</Pill>
          <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            Gratis untuk coba. Sekali bayar kalau mau serius.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Satu Session Pass membuka semua fitur untuk seluruh peserta di ruang itu — tanpa iklan, tanpa langganan.
          </p>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="surface rounded-3xl p-7">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold">Free</h3>
              <Pill>Rp 0</Pill>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Cukup untuk sesi iseng berdua.</p>
            <ul className="mt-6 space-y-3 text-sm text-foreground/85">
              {freePlan.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-input/60" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/create" className="mt-7 block">
              <Button className="w-full" size="lg" variant="secondary">
                Coba gratis
              </Button>
            </Link>
          </div>

          <div className="surface relative overflow-hidden rounded-3xl border-primary/45 bg-gradient-to-br from-secondary via-card to-accent p-7 shadow-[0_34px_70px_-40px_var(--primary)]">
            <div className="sparkle pointer-events-none absolute inset-0 opacity-25" aria-hidden />
            <div className="shine pointer-events-none absolute inset-0 opacity-25" aria-hidden />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold">Session Pass</h3>
                <Pill tone="pro">Rp 12.000</Pill>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Sekali bayar per ruang, semua peserta dapat akses.</p>
              <ul className="mt-6 space-y-3 text-sm text-foreground/90">
                {passPlan.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/create" className="mt-7 block">
                <Button className="w-full" size="lg">
                  Buat ruang sekarang
                  <ArrowUpRight className="size-4" aria-hidden />
                </Button>
              </Link>
              <p className="mt-3 text-center text-xs text-muted-foreground">QRIS, e-wallet, transfer — via Midtrans.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/40 px-5 py-10 sm:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Logo />
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
              Foto diproses di perangkat kamu dan tautan hasil otomatis kedaluwarsa dalam 24 jam.
            </p>
          </div>
          <ul className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <QrCode className="size-3.5" aria-hidden /> Share via QR
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden /> 2–4 peserta
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Apple className="size-3.5" aria-hidden /> iOS &amp; Android
            </li>
          </ul>
        </div>
      </footer>
    </main>
  );
}
