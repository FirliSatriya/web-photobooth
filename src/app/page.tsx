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

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(226,82,58,0.18),transparent_55%)]" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-white/55 md:flex">
          <a className="transition hover:text-white" href="#cara-kerja">
            Cara kerja
          </a>
          <a className="transition hover:text-white" href="#frame">
            Frame
          </a>
          <a className="transition hover:text-white" href="#harga">
            Harga
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/join">
            <Button variant="ghost" size="sm">
              Gabung ruang
            </Button>
          </Link>
          <Link href="/create">
            <Button size="sm">
              Mulai sesi
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <HomeHero />

      <section id="cara-kerja" className="relative z-10 mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Pill tone="live">
              <Sparkles className="h-3 w-3" /> Cara kerja
            </Pill>
            <h2 className="mt-4 max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Empat langkah dari ruang kosong ke photostrip.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-white/50">
            Tidak ada aplikasi yang perlu diinstal. Semua pemrosesan berat berjalan di perangkat kamu
            sendiri, jadi hasil keluar dalam hitungan detik.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div
              key={step.n}
              className="surface group relative overflow-hidden rounded-3xl p-6 transition hover:border-white/20"
            >
              <span className="text-[11px] font-semibold tracking-[0.2em] text-flame/80">{step.n}</span>
              <h3 className="mt-3 text-lg font-medium tracking-tight">{step.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{step.d}</p>
              <div className="mt-6 h-px w-full bg-gradient-to-r from-white/20 to-transparent" />
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="surface rounded-3xl p-6 sm:p-7">
              <feature.icon className="h-5 w-5 text-flame" />
              <h3 className="mt-4 text-lg font-medium tracking-tight">{feature.title}</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/50">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <FrameGallery />

      <section id="harga" className="relative z-10 mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
        <div className="mb-10 max-w-xl">
          <Pill>Harga</Pill>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Gratis untuk coba. Sekali bayar kalau mau serius.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            Satu Session Pass membuka semua fitur untuk seluruh peserta di ruang itu — tanpa iklan, tanpa langganan.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface rounded-3xl p-7">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Free</h3>
              <Pill>Rp 0</Pill>
            </div>
            <p className="mt-1 text-sm text-white/45">Cukup untuk sesi iseng berdua.</p>
            <ul className="mt-6 space-y-2.5 text-sm text-white/60">
              {[
                "Sesi maksimal 10 menit",
                "2 peserta (1-on-1)",
                "Foto HD 720p + watermark kecil",
                "5 frame dasar, 3 filter",
                "Retake maksimal 1x",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-flame/35 bg-gradient-to-br from-flame/20 via-[#1a1210] to-[#12100e] p-7">
            <div className="shine pointer-events-none absolute inset-0 opacity-30" />
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Session Pass</h3>
              <Pill tone="pro">Rp 12.000</Pill>
            </div>
            <p className="mt-1 text-sm text-white/50">Sekali bayar per ruang, semua peserta dapat akses.</p>
            <ul className="mt-6 space-y-2.5 text-sm text-white/75">
              {[
                "Sesi hingga 60 menit",
                "Hingga 4 peserta dalam 1 frame",
                "Ultra HD 1080p / 2K tanpa watermark",
                "Semua frame premium + upload custom",
                "Boomerang MP4 & AI Studio Backdrop",
                "Retake tanpa batas",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-flame" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/create" className="mt-7 block">
              <Button className="w-full" size="lg">
                Buat ruang sekarang
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="mt-3 text-center text-[11px] text-white/35">QRIS, e-wallet, transfer — via Midtrans.</p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/8 px-5 py-10 sm:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Logo />
            <p className="max-w-md text-xs leading-relaxed text-white/35">
              Foto diproses di perangkat kamu dan tautan hasil otomatis kedaluwarsa dalam 24 jam.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs text-white/40">
            <span className="inline-flex items-center gap-1.5">
              <QrCode className="h-3.5 w-3.5" /> Share via QR
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> 2–4 peserta
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Apple className="h-3.5 w-3.5" /> iOS & Android
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
