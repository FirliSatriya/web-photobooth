# Remote Photobooth

Bilik photobooth virtual untuk 2–4 orang yang berada di kota berbeda. Setiap peserta mengirim **frame kamera resolusi tinggi** lewat `RTCDataChannel` (bukan screenshot video WebRTC), host merakitnya dengan **OffscreenCanvas di Web Worker**, lalu hasil akhir dibagikan lewat tautan 24 jam + QR code.

Dibangun mengikuti `product_requirements_document_remote_collaborative_web_photobooth_final_revised.md` (PRD v2.0).

---

## Ringkasan fitur

| Area | Implementasi |
| :--- | :--- |
| Dual-stream capture | Pratinjau video WebRTC latensi rendah + jepretan resolusi tinggi dari `<video>` lokal (maks. 1440 px free / 2048 px paid) |
| Sinkronisasi | Clock offset `PING/PONG` (sample RTT terendah), countdown 3 detik terjadwal, flash + suara rana di semua perangkat |
| DataChannel chunking | Potongan 48 KB dengan header JSON + newline, dirakit ulang menjadi `Blob` di host |
| Compositing | Web Worker + `OffscreenCanvas`, geometri sama untuk preview & export (`src/lib/layout.ts`) |
| Filter | WebGL2 shader (`src/lib/filters.ts`) dengan fallback `ctx.filter` Canvas 2D |
| Bingkai | 9 preset (`src/lib/frames.ts`) untuk `1x4_strip`, `2x2_grid`, `1x2_wide` |
| Boomerang | Ring buffer 1,5 detik → MP4 via WebCodecs + `mp4-muxer` (ping-pong) |
| AI Studio Backdrop | MediaPipe Selfie Segmentation on-device, 6 preset studio (Session Pass) |
| Perangkat | `enumerateDevices`, `devicechange` hot-plug, `replaceTrack` tanpa memutus panggilan, mirror independen, negosiasi resolusi dengan fallback, kontrol UVC (Session Pass) |
| Output | Unduh PNG + MP4, QR code, tautan `/share/[token]` aktif 24 jam |
| Monetisasi | Session Pass Rp 12.000 (Midtrans Snap), unlock real-time ke seluruh peserta |

---

## Menjalankan

```bash
npm install          # sekaligus menyalin WASM MediaPipe ke /public
npm run dev          # http://localhost:3000
```

Tanpa variabel lingkungan sama sekali, aplikasi berjalan dalam **demo lokal**:

- room disimpan di memori server (`15 menit` TTL),
- signaling memakai `BroadcastChannel` → buka beberapa tab di browser yang sama,
- hasil disimpan di memori proses dan disajikan lewat `/api/output/[token]` (24 jam),
- Session Pass langsung aktif (tanpa gateway) supaya seluruh fitur bisa diuji.

Pil **“demo lokal”** di header menandakan mode ini.

### Model AI backdrop

Model segmentasi tidak ikut di-commit (± 250 KB). Unduh sekali:

```bash
node scripts/fetch-model.mjs     # public/models/selfie_segmenter.tflite
```

`scripts/copy-mediapipe.mjs` berjalan otomatis pada `postinstall` dan menyalin runtime WASM ke `public/mediapipe/wasm`.

### Perintah lain

```bash
npm run typecheck    # tsc --noEmit
npm run build        # production build
npm start            # jalankan hasil build
```

---

## Konfigurasi (`.env.local`)

Semua opsional; isi hanya yang dipakai. Lihat `.env.example` untuk daftar lengkap.

```ini
# Supabase — auth opsional, DB + storage + realtime signaling
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=photobooth-outputs

# Cloudflare R2 (prioritas di atas Supabase Storage)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=

# WebRTC ICE
NEXT_PUBLIC_STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
NEXT_PUBLIC_TURN_URL=
NEXT_PUBLIC_TURN_USERNAME=
NEXT_PUBLIC_TURN_CREDENTIAL=

# Midtrans Snap
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Supabase

1. Jalankan migrasi `supabase/migrations/0001_init.sql` (tabel `frames`, `rooms`, `transactions`, `photo_outputs`, RLS, index).
2. Jalankan `supabase/seed-frames.sql` untuk mengisi katalog bingkai.
3. Aktifkan `pg_cron` lalu jadwalkan pembersihan metadata > 24 jam (blok komentar di akhir migrasi).

Tanpa Supabase, seluruh lapisan server otomatis memakai store in-memory.

### Storage

Urutan prioritas: **R2 → Supabase Storage → memori**.

- R2: aktifkan *lifecycle rule* `Delete object after 24 days/hours` pada bucket agar objek lama hilang otomatis.
- Supabase: bucket publik `photobooth-outputs`.

### Midtrans

Isi `MIDTRANS_SERVER_KEY` + `MIDTRANS_CLIENT_KEY`, lalu arahkan **Payment Notification URL** ke:

```
https://<domain>/api/payments/notification
```

Webhook memverifikasi `signature_key` (`SHA512(order_id + status_code + gross_amount + serverKey)`) dan mengubah `rooms.tier` menjadi `paid`. Room yang sudah dibayar tetap bisa di-unlock ulang (idempoten). Selama kunci belum diisi, endpoint pembayaran mengembalikan `provider: "demo"` dan `/api/payments/demo-confirm` menyelesaikan order secara instan.

### TURN

Untuk jaringan ketat (kantor/kampus) isi `NEXT_PUBLIC_TURN_URL` + kredensial; tanpa TURN koneksi P2P bisa gagal pada NAT simetris.

---

## Struktur

```
src/
  app/
    page.tsx                  landing + form kode
    create/                   pembuatan ruang tanpa login
    join/                     masuk lewat kode 6 digit
    room/[code]/              lobby → booth → result
    share/[token]/            halaman hasil 24 jam + QR
    api/
      rooms/                  create / get / patch (retake, frame, complete, unlock)
      output/                 upload hasil + serve image/video
      payments/               create, notification (webhook), demo-confirm
  components/booth/           Booth, StagePreview, LobbyPanel, FramePicker,
                              BackdropPicker, DevicePicker, PaywallModal, ResultPanel
  hooks/                      useLocalMedia, useWebRTC, useSignaling, useSession,
                              useMediaWorker, useEffects
  lib/
    layout.ts  frames.ts  compose.ts  stage.ts  filters.ts  capture.ts
    signaling.ts  clock.ts  chunking.ts  protocol.ts  backdrop.ts
    server/store.ts  server/storage.ts  storage/idb.ts
    workers/media.worker.ts
supabase/                     migrasi + seed
scripts/                      copy-mediapipe.mjs, fetch-model.mjs
```

### Alur satu sesi

1. **Lobby** — izin kamera, pilih perangkat, uji framing, tandai “Saya siap”. Host menekan “Masuk ke bilik”.
2. **Booth** — host menekan “Mulai jepret”. Untuk setiap slot host menyiarkan `at` (target waktu host), semua peserta menjadwalkan shutter pada waktu lokal hasil `clock.hostToLocal(at)`.
3. **Capture** — tiap perangkat mengambil frame lokal, host menyimpan ke `shotsRef` + IndexedDB; guest mengirim potongan DataChannel ke host.
4. **Compose** — host mengirim permintaan ke worker (`composePhoto`), upload ke storage, lalu menyiarkan `{ t: "result" }` sehingga semua peserta melihat halaman hasil.
5. **Share** — tautan `/share/[token]` + QR, aktif 24 jam. Boomerang MP4 tersedia untuk tier paid.

---

## Tier

| | Free | Session Pass |
| :--- | :--- | :--- |
| Durasi | 10 menit | 60 menit |
| Peserta | 2 | 4 |
| Resolusi | long edge 1280 + watermark | 2560–2880, tanpa watermark |
| Bingkai/filter | 5 bingkai, 3 filter | semua + UVC |
| Boomerang | — | MP4 |
| AI backdrop | — | ✓ |
| Retake | 1× | tanpa batas |

Batas ditegakkan di server (`src/lib/server/store.ts`) dan di klien (`useRoomLimits`), termasuk retake dari halaman hasil.

---

## Catatan teknis

- **Preview = export.** `buildStageLayers()` (preview) dan `composePhoto()` (export) memakai `getGeometry()` yang sama, jadi posisi slot, caption, dan watermark identik.
- **Center-crop** diterapkan lewat `drawCover()` agar wajah tidak gepeng saat rasio kamera (16:9) berbeda dengan slot (3:4 / 1:1).
- **Clock sync**: host otoritatif. Guest menyimpan sample `offset` dengan RTT terendah; label di booth menampilkan `sync <n> ms`.
- **Fallback**: WebGL2 → Canvas 2D `ctx.filter`; WebCodecs tidak tersedia → boomerang dilewati dengan toast; `OverconstrainedError` → `getUserMedia` tanpa constraint ideal.
- **Boomerang**: ring buffer 18 frame @12 fps (±1,5 s) lalu di-encode ping-pong (frame dibalik) menjadi ±3 s MP4. Dimensi dibulatkan ke angka genap karena H.264 menolak lebar/tinggi ganjil — preview `2x2_grid` bisa menghasilkan 495×540.
- **Tab tersembunyi**: `scheduleAt()` jatuh ke `setTimeout` karena `requestAnimationFrame` dihentikan browser, dan boomerang memperingatkan bahwa rekaman butuh tab terlihat.
- **In-app browser** (Instagram/TikTok/LINE) dideteksi `AppGate` dan menampilkan instruksi membuka di Chrome/Safari.
- **IndexedDB** menyimpan raw shot host per room (`pruneOldShots` menghapus data > 24 jam / room lain).
- **Privasi**: video tidak pernah diunggah; hanya hasil akhir (PNG/MP4) yang disimpan sementara.

## Verifikasi

- `npm run typecheck` bersih.
- `npm run build` sukses.
- E2E manual (Chrome + fake media): 2 tab create → join → booth → 4 jepretan → hasil di host & guest → halaman share 421×1280; layout `1x2_wide` 2880×2049; `2x2_grid` 4 peserta 2346×2560; boomerang MP4 ± 66–73 KB (2,9 s, 178×540) dan diputar ulang di `<video>`; retake kuota free 1× lalu paywall, setelah unlock `∞`.
- Mobile 390×844: landing, green room, booth, dan hasil tanpa overflow horizontal (`scrollWidth === clientWidth`).
