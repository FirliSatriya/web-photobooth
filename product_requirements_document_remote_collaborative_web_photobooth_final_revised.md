# Product Requirements Document (PRD): Remote Collaborative Web Photobooth

**Dokumen Versi:** 2.0 (Final Revised)  
**Status:** Siap Pengembangan (Ready for Engineering)  
**Arsitektur Utama:** Serverless / P2P-First WebRTC + Client-Side GPU Processing  

---

## 1. Product Overview & Value Proposition

Aplikasi web *photobooth* berbasis *real-time video* (WebRTC) yang memungkinkan dua hingga empat pengguna di lokasi geografis berbeda berfoto bersama dalam satu *frame* secara sinkron. Pengguna melihat *live preview* gabungan di layar, mengatur pose bersama, memilih perangkat kamera (termasuk *webcam* eksternal pada PC), lalu sistem mengambil *snapshot* resolusi tinggi, menerapkan *filter* WebGL serta bingkai, dan menghasilkan foto maupun video *boomerang* siap unduh.

* **Core Differentiation:** Menggabungkan interaksi *video call* latensi rendah dengan **Dual-Stream Capture** dan *compositing* GPU sisi klien (*client-side*) untuk menghasilkan foto tajam resolusi penuh (1080p/2K) serta video pendek MP4—bukan hasil *screenshot* aliran video WebRTC yang terkompresi dan buram.

---

## 2. Target Audience & User Personas

1. **Long-Distance Couples / Friends (LDR):** Ingin membuat kenang-kenangan virtual yang terasa nyata seperti masuk ke bilik *photobooth* fisik tanpa terhalang jarak.
2. **PC / Desktop Creators & Streamers:** Menggunakan *webcam* eksternal resolusi tinggi (atau *virtual camera* OBS/Camo) untuk berfoto bersama teman atau komunitas dengan kualitas studio.
3. **K-Pop / Pop Culture Fans:** Ingin berfoto menggunakan *frame* bertema khusus (*fandom frames*) bersama teman sesama penggemar dari kota berbeda.
4. **Event / Community Hosts:** Membutuhkan aktivasi virtual yang seru dan mudah dibagikan ke media sosial tanpa perlu menginstal aplikasi tambahan.

---

## 3. Recommended Modern Tech Stack

Pemilihan teknologi difokuskan pada performa tinggi di sisi peramban (*client-side heavy*), latensi rendah, dan biaya infrastruktur mendekati nol pada fase awal:

* **Frontend Framework:** Next.js (App Router) atau React + Vite (TypeScript).
* **UI & Styling:** Tailwind CSS + Shadcn UI (responsif untuk layar vertikal ponsel maupun layar lebar desktop).
* **Real-Time Communication:** Native WebRTC API (`RTCPeerConnection`, `RTCDataChannel`, `RTCRtpSender.replaceTrack`).
* **Graphics & Media Engine:**
  * **OffscreenCanvas + Web Workers:** Menjalankan proses *compositing* foto di *background thread* agar antarmuka tidak pernah *freeze* (60fps).
  * **WebGL2 Fragment Shaders:** Rendering *filter* warna (*film grain*, *vintage*, *B&W*) secara konsisten antara pratinjau langsung dan hasil ekspor akhir.
  * **WebCodecs API (`VideoEncoder`):** Akselerasi *hardware* GPU peramban untuk merender *Live Photo / Boomerang* menjadi file MP4 (H.264) secara instan.
  * **MediaPipe Selfie Segmentation (WASM):** Pemisahan latar belakang berbasis AI lokal untuk fitur *Virtual Studio Backdrop* (Tier Pro).
* **Backend, Auth & Signaling:** Supabase (PostgreSQL, Supabase Auth, Supabase Realtime Broadcast/Presence, Edge Functions).
* **Networking Infrastructure:** Cloudflare Calls (STUN/TURN Server) untuk menembus *firewall* dan jaringan seluler ketat.
* **Storage & CDN:** Cloudflare R2 (Zero egress fee + *Lifecycle Policy* penghapusan otomatis 24 jam).
* **Payment Gateway:** Midtrans (Snap API) / Xendit untuk dukungan QRIS & E-Wallet instan.

---

## 4. Critical Engineering Architecture & Data Flow

### A. Dual-Stream Synchronized Capture
Memisahkan jalur pratinjau video berlatensi rendah dengan jalur pengambilan gambar beresolusi tinggi:

1. **Handshake & Clock Calibration:** Saat peserta bergabung ke saluran Supabase Realtime (`room_id`), sistem melakukan negosiasi WebRTC P2P sekaligus menghitung selisih waktu lokal (*clock skew*) melalui mekanisme `PING-PONG` agar akurasi jepretan meleset di bawah `< 30ms`.
2. **Synchronized Countdown:** *Host* menyiarkan perintah `START_TIMER` berisi stempel waktu target (`target_ts = server_time + 3000ms`). Hitungan mundur `3... 2... 1...` berjalan serentak di semua layar.
3. **Raw Local Capture:** Tepat pada `target_ts`, setiap perangkat mengambil bingkai mentah resolusi tinggi langsung dari kamera lokal mereka (`ImageCapture API` atau `<canvas>` tersembunyi), melewati kompresi *bitrate* video WebRTC.
4. **DataChannel Chunking:** Hasil tangkapan lokal (format WebP kualitas 92%, ukuran ~300–800 KB) dipecah menjadi potongan `ArrayBuffer` berukuran **16 KB – 64 KB** dan dikirim melalui `RTCDataChannel` ke perangkat *Host*.
5. **Offscreen Compositing:** *Host* merakit potongan data menjadi `Blob`, menyerahkannya ke **Web Worker (`OffscreenCanvas`)** untuk digabungkan dengan bingkai PNG, *filter* WebGL, dan *watermark* (jika tier `free`), lalu mengunggah hasil akhir ke Cloudflare R2.

---

## 5. Functional Requirements

### A. Device & Camera Settings (Lobby & In-Booth)
* **Input Switcher (`enumerateDevices`):** Pengguna dapat memilih sumber kamera (`videoinput`) dan mikrofon (`audioinput`), termasuk *webcam* USB eksternal pada PC maupun kamera depan/belakang pada ponsel.
* **Hot-Plug Detection (`devicechange`):** Daftar perangkat otomatis diperbarui jika pengguna mencolokkan *webcam* eksternal saat halaman web sudah terbuka.
* **Seamless Track Switching (`replaceTrack`):** Penggantian kamera di tengah sesi langsung memperbarui aliran video ke lawan bicara tanpa memutus panggilan WebRTC.
* **Independent Mirror Toggle:** Tombol pembalik horizontal (*flip*) mandiri per pengguna untuk mengatasi orientasi terbalik pada *webcam* PC eksternal.
* **Resolution Negotiation:** Meminta resolusi optimal (`ideal: 1920x1080`) dengan penurunan otomatis (*graceful fallback*) untuk mencegah galat `OverconstrainedError` pada *webcam* standar.
* **Hardware UVC Controls (Tier Pro):** Pengaturan *zoom* digital, *exposure*, dan *white balance* langsung dari antarmuka jika didukung perangkat keras kamera.

### B. Room & Session Management
* **Frictionless Room Creation:** *Host* dapat membuat ruang tanpa wajib *login*, menghasilkan tautan unik dan kode ruang 6 digit.
* **Green Room / Lobby:** Pemeriksaan izin kamera/mikrofon, pemilihan *webcam*, dan uji coba *framing* sebelum masuk ke bilik utama.
* **Participant Capacity:** 2 peserta (Tier Gratis) dan hingga 4 peserta (Tier Berbayar).

### C. Photobooth Core & Post-Processing
* **Live Compositing Grid:** Pratinjau gabungan langsung sesuai tata letak (*1x4 photo strip*, *2x2 grid*, *1x2 wide*).
* **Synchronized Shutter & Flash:** Efek kilatan cahaya putih di layar dan suara rana kamera yang serentak saat foto diambil.
* **Retake Mechanism:** Opsi mengulang jepretan per *slot* foto sebelum sesi dikunci.
* **Live Photo / Boomerang (Tier Pro):** Perekaman *buffer* 1,5 detik sebelum jepretan yang dikodekan via **WebCodecs** menjadi MP4.
* **AI Virtual Studio Backdrop (Tier Pro):** Mengganti latar belakang ruangan menjadi latar studio polos warna-warni secara *real-time* di peramban.
* **Customization:** Koleksi bingkai PNG transparan, *filter* warna WebGL2, stiker digital, dan stempel tanggal otomatis (*analog timestamp*).

### D. Output & Sharing
* **Instant High-Res Download:** Unduh langsung foto akhir (PNG/JPG) dan video *boomerang* (MP4) ke perangkat.
* **QR Code & 24-Hour Share Link:** Kode QR pada layar hasil akhir agar pengguna PC dapat memindai dan langsung menyimpan foto ke ponsel mereka.

---

## 6. Monetization Strategy (Freemium Model)

Menggunakan model **One-Time Session Pass** (sekali bayar per ruang/sesi) agar konversi lebih tinggi dan tidak mengganggu estetika aplikasi dengan iklan.

| Fitur & Kapabilitas | Paket Gratis (Free) | Paket Berbayar (Session Pass: Rp 12.000 – Rp 15.000) |
| :--- | :--- | :--- |
| **Durasi Sesi** | Maksimal 10 menit per ruang | Hingga 60 menit per ruang |
| **Jumlah Peserta** | 2 Orang (1-on-1) | Hingga 4 Orang dalam 1 *frame* |
| **Resolusi & Watermark** | HD (720p) + *Watermark* kecil | Ultra HD (1080p/2K) tanpa *watermark* |
| **Koleksi Frame & Filter** | 5 *frame* dasar & 3 *filter* | Semua *frame* eksklusif + *Custom Frame Upload* |
| **Live Photo / Boomerang** | Tidak tersedia | Tersedia (Ekspor MP4 HD via WebCodecs) |
| **AI Studio Background** | Tidak tersedia | Tersedia (Ganti latar belakang studio virtual) |
| **Batas Ulang Foto (Retake)** | Maksimal 1x per sesi | Tanpa batas pengulangan |

* **Mekanisme Unlock Real-Time:** Begitu pembayaran QRIS terkonfirmasi melalui *webhook* Midtrans/Xendit, status *room* di database berubah menjadi `paid` dan otomatis membuka seluruh fitur premium bagi *Host* maupun *Guest* di dalam ruang tersebut tanpa perlu memuat ulang halaman.

---

## 7. Database Schema (Supabase PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Koleksi Template Bingkai
CREATE TABLE frames (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    overlay_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    layout_type VARCHAR(20) NOT NULL CHECK (layout_type IN ('1x4_strip', '2x2_grid', '1x2_wide')),
    slot_coordinates JSONB NOT NULL,
    max_participants INT DEFAULT 2,
    is_premium BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sesi Photobooth (Rooms)
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code VARCHAR(6) UNIQUE NOT NULL,
    host_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    host_session_token VARCHAR(255) NOT NULL,
    tier VARCHAR(10) DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
    max_participants INT DEFAULT 2,
    retakes_used INT DEFAULT 0,
    max_retakes INT DEFAULT 1,
    selected_frame_id UUID REFERENCES frames(id),
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rooms_room_code ON rooms(room_code) WHERE status IN ('waiting', 'active');

-- 3. Transaksi Pembayaran Session Pass
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    gateway_order_id VARCHAR(100) UNIQUE NOT NULL,
    amount INT NOT NULL,
    currency VARCHAR(3) DEFAULT 'IDR',
    payment_method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Hasil Foto & Boomerang Sementara
CREATE TABLE photo_outputs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    final_image_url TEXT NOT NULL,
    boomerang_video_url TEXT,
    delete_after TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Critical Edge Cases & Mitigasi Risiko

1. **In-App Browser Limitation (Instagram/TikTok Browser):** Peramban bawaan media sosial sering memblokir akses `getUserMedia` atau WebCodecs. *Mitigasi:* Deteksi *User-Agent* sejak awal; tampilkan instruksi visual untuk membuka tautan di Safari atau Chrome, serta sediakan *fallback* otomatis ke Canvas 2D standar jika WebGL2/WebCodecs tidak tersedia.
2. **Perbedaan Rasio Layar (HP Vertikal vs Webcam PC 16:9):** *Mitigasi:* Terapkan pemotongan terpusat (*center-crop*) pada *canvas* sesuai rasio *slot* bingkai (misal `3:4` atau `1:1`) agar proporsi wajah tetap seimbang saat digabungkan.
3. **Koneksi Terputus / Refresh Halaman:** *Mitigasi:* Simpan foto mentah tiap *slot* yang sudah berhasil diambil ke `IndexedDB` lokal milik *Host* agar sesi dapat dipulihkan jika terjadi gangguan jaringan singkat.
4. **Privasi & Biaya Penyimpanan:** *Mitigasi:* Terapkan *Lifecycle Rule* pada Cloudflare R2 untuk menghapus seluruh objek yang berusia lebih dari 24 jam secara otomatis, ditambah `pg_cron` di Supabase untuk membersihkan metadata kedaluwarsa.

---

## 9. Phased Execution Roadmap

* **Phase 1 — Core MVP (Minggu 1–3):**
  * Setup Next.js + Supabase Realtime + Cloudflare TURN.
  * Lobby pemilihan perangkat kamera/webcam (`enumerateDevices` & `replaceTrack`).
  * Koneksi WebRTC 1-on-1 + Dual-Stream Capture via DataChannel *chunking*.
  * Penggabungan foto dengan `OffscreenCanvas` (Web Worker) + 3 *frame* dasar.
* **Phase 2 — Monetization & Modern Media (Minggu 4–5):**
  * Integrasi QRIS (Midtrans/Xendit) + *webhook* pembaruan tier *real-time*.
  * Implementasi *filter* WebGL2, *watermark* dinamis, dan *Live Photo/Boomerang* berbasis WebCodecs.
  * Halaman hasil akhir dengan fitur QR Code untuk transfer cepat dari PC ke ponsel.
* **Phase 3 — Pro Features & Scale (Minggu 6+):**
  * Fitur AI *Virtual Studio Backdrop* (MediaPipe WASM).
  * *Custom Frame Uploader* untuk pengguna berbayar dan dukungan hingga 4 peserta dalam satu ruang.

---

## 10. Key Success Metrics (KPIs)

* **Session Completion Rate:** Persentase ruang aktif yang berhasil menyelesaikan seluruh jepretan hingga menekan tombol unduh (Target: **> 65%**).
* **Free-to-Paid Conversion Rate:** Persentase *Host* yang membeli *Session Pass* dalam satu sesi (Target: **3% – 7%**).
* **Capture Sync Accuracy:** Selisih waktu pengambilan gambar antar perangkat dalam satu sesi (Target: **< 50ms**).
* **Average Session Turnaround:** Durasi rata-rata dari pembuatan ruang hingga pengunduhan hasil akhir (Target: **< 4 menit**).