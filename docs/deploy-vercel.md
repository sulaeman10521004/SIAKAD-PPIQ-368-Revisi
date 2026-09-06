# Panduan Deploy ke Vercel — SIAKAD PPIQ-368

Panduan ini melengkapi panduan instalasi lokal: isinya langkah dari **clone bersih**
sampai aplikasi hidup di produksi Vercel, termasuk menyambungkan database
**Prisma Postgres (Prisma Cloud)**. Seluruh langkah memakai **Vercel CLI** supaya
bisa diulang persis oleh siapa pun yang menerima serah terima proyek ini.

- Repositori: `https://github.com/mrramdn/SIAKAD-PPIQ-368.git`
- Aplikasi: Next.js 16 (App Router) + Prisma 7 + PostgreSQL
- Waktu yang dibutuhkan: sekitar 20–30 menit untuk lingkungan yang benar-benar baru

---

## 1. Cara kerja deploy proyek ini

Sebelum menjalankan perintah, pahami tiga hal yang membuat proyek ini berbeda dari
aplikasi Next.js polos:

| Hal | Keterangan |
| --- | --- |
| **Migrasi ikut di dalam build** | Script `build` di `package.json` berbunyi `prisma migrate deploy && prisma generate && next build`. Artinya setiap deploy otomatis menerapkan migrasi ke database yang ditunjuk `DATABASE_URL`. Tidak perlu langkah migrasi manual, tetapi konsekuensinya: **build akan gagal kalau `DATABASE_URL` belum diisi atau salah bentuk.** |
| **Prisma Client dibuat saat build** | Folder `generated/` masuk `.gitignore`, jadi klien Prisma tidak ikut ter-commit dan wajib dihasilkan ulang oleh `prisma generate` di setiap build. |
| **Koneksi lewat driver adapter** | `lib/prisma.ts` memakai `@prisma/adapter-pg`. Adapter ini **hanya menerima connection string PostgreSQL langsung** (`postgres://…`), bukan URL Accelerate (`prisma+postgres://…`). Lihat [bagian 4](#4-siapkan-database-di-prisma-cloud). |

Hanya ada **satu** variabel lingkungan yang wajib: `DATABASE_URL`. Sesi login
disimpan di tabel `Session` dengan token acak, jadi tidak ada `SESSION_SECRET`
atau kunci lain yang perlu disiapkan.

---

## 2. Prasyarat

| Kebutuhan | Versi / catatan |
| --- | --- |
| Node.js | 24 LTS (Vercel menjalankan build di Node 24.x) |
| pnpm | 9 atau lebih baru — repo memakai `pnpm-lock.yaml` |
| Git | akses ke repositori GitHub di atas |
| Akun Vercel | https://vercel.com — cukup paket Hobby |
| Akun Prisma | https://console.prisma.io — untuk Prisma Postgres |
| Vercel CLI | `npm i -g vercel@latest`, atau jalankan tanpa instal dengan `npx vercel` |

Verifikasi cepat:

```bash
node -v          # v24.x
pnpm -v
vercel --version # >= 59
```

---

## 3. Clone bersih dan instal dependensi

```bash
git clone https://github.com/mrramdn/SIAKAD-PPIQ-368.git
cd SIAKAD-PPIQ-368
pnpm install
```

> **Penting:** seluruh perintah `vercel` pada panduan ini dijalankan **dari dalam
> folder hasil clone ini**. Folder inilah akar aplikasi (`package.json`,
> `next.config.ts`, dan `prisma/` ada di sini), dan `vercel link` akan membuat
> folder `.vercel/` di sini pula. Menjalankan `vercel link` dari folder induk
> membuat CLI menunjuk direktori yang salah saat deploy.

---

## 4. Siapkan database di Prisma Cloud

### 4.1 Pilih jalur pembuatan database

**Jalur A — lewat Vercel Marketplace (paling ringkas).**
Database dibuat sekaligus disambungkan ke proyek Vercel, dan variabelnya otomatis
terpasang. Jalankan setelah proyek di-link (bagian 5):

```bash
vercel integration add prisma
```

Bila CLI mengalihkan ke browser untuk otorisasi akun, selesaikan di browser lalu
kembali ke terminal.

**Jalur B — lewat Prisma Console (dipakai proyek ini sekarang).**

1. Buka https://console.prisma.io lalu login.
2. **New project** → beri nama (mis. `siakad-ppiq368`) → pilih region terdekat
   (mis. `ap-southeast-1` Singapura).
3. Masuk ke database yang baru dibuat → menu **Connect** / **API keys**.
4. Salin **connection string TCP langsung**, bukan URL Accelerate.

### 4.2 Bentuk connection string yang benar

| | Bentuk | Dipakai? |
| --- | --- | --- |
| ✅ | `postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require` | **Ya.** Ini yang cocok dengan `@prisma/adapter-pg` dan dengan `prisma migrate deploy`. |
| ❌ | `prisma+postgres://accelerate.prisma-data.net/?api_key=…` | Tidak. Ini URL Accelerate (HTTP). Driver adapter menolaknya dan build gagal. |

Kalau lalu lintas produksi mulai ramai, tambahkan parameter pooling supaya
fungsi serverless tidak menghabiskan kuota koneksi:

```
postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require&pool=true
```

> **Peringatan serah terima:** siapkan **dua database terpisah** — satu untuk
> Production dan satu untuk Preview. Karena migrasi berjalan otomatis di setiap
> build, memakai satu database yang sama membuat deploy preview ikut mengubah
> skema data produksi.

---

## 5. Buat dan sambungkan proyek Vercel

```bash
vercel login
vercel link
```

Jawaban yang benar saat `vercel link` bertanya:

| Pertanyaan | Jawaban |
| --- | --- |
| Set up and deploy? / Link to existing project? | **Link to existing** bila proyek `pesantren-lms` sudah ada; **Create new** bila memulai dari nol |
| In which scope? | akun/tim tujuan |
| In which directory is your code located? | `./` (biarkan default) |

Pengaturan proyek yang dipakai — biarkan bawaan, jangan di-override:

| Setelan | Nilai |
| --- | --- |
| Framework Preset | Next.js (terdeteksi otomatis) |
| Root Directory | `.` |
| Build Command | default → menjalankan `npm run build` dari `package.json` |
| Install Command | default → terdeteksi `pnpm install` dari `pnpm-lock.yaml` |
| Node.js Version | 24.x |

Cek hasilnya kapan saja:

```bash
vercel project inspect pesantren-lms
```

---

## 6. Isi environment variables

Tambahkan `DATABASE_URL` ke tiga environment. CLI akan meminta nilainya secara
interaktif (nilai tidak tampil di layar):

```bash
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview
vercel env add DATABASE_URL development
```

Opsional, bila nama aplikasi ingin diganti tanpa menyentuh kode:

```bash
vercel env add NEXT_PUBLIC_APP_NAME production
```

Daftar lengkap variabel yang dikenali aplikasi:

| Variabel | Wajib | Contoh | Dibaca di |
| --- | --- | --- | --- |
| `DATABASE_URL` | **ya** | `postgres://…@db.prisma.io:5432/postgres?sslmode=require` | `lib/prisma.ts`, `prisma.config.ts`, `prisma/seed.ts` |
| `NEXT_PUBLIC_APP_NAME` | tidak | `SIAKAD PPIQ-368` | `lib/brand.ts` (nilai bawaan sudah sama) |
| `SEED_ADMIN_NAME` | seed saja | `Administrator SIAKAD` | `prisma/seed.ts` — **jangan** dipasang di Vercel |
| `SEED_ADMIN_EMAIL` | seed saja | `admin@email.com` | `prisma/seed.ts` — **jangan** dipasang di Vercel |
| `SEED_ADMIN_PASSWORD` | seed saja | minimal 8 karakter | `prisma/seed.ts` — **jangan** dipasang di Vercel |
| `SEED_ADMIN_PHONE` | tidak | `081234567890` | `prisma/seed.ts` — opsional |

Periksa dan tarik ke lokal:

```bash
vercel env ls                    # menampilkan nama saja, nilai tetap tersembunyi
vercel env pull .env.local       # untuk menjalankan `pnpm dev` dengan DB yang sama
```

---

## 7. Migrasi dan data awal

### 7.1 Migrasi

Tidak ada langkah manual: `prisma migrate deploy` sudah berjalan di setiap build
Vercel. Bila perlu menjalankannya sendiri dari komputer (mis. untuk memeriksa
migrasi sebelum deploy):

```bash
vercel env pull .env.local   # ambil DATABASE_URL environment Development
pnpm db:deploy               # prisma migrate deploy
```

Untuk menerapkan migrasi ke database **produksi** dari lokal, isi `DATABASE_URL`
produksi di `.env` sementara, jalankan `pnpm db:deploy`, lalu hapus kembali.

### 7.2 Data awal (seed)

```bash
pnpm db:seed
```

Seed hanya membuat **satu akun administrasi**, tanpa data contoh sama sekali —
tidak ada santri, mapel, kelas, jadwal, absensi, maupun nilai. Seluruh data
diisi lewat aplikasi setelah login.

Kredensialnya diambil dari environment variable, jadi tidak ada kata sandi yang
tertanam di dalam kode:

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `SEED_ADMIN_NAME` | ya | nama yang tampil di aplikasi |
| `SEED_ADMIN_EMAIL` | ya | dipakai untuk login, harus format email valid |
| `SEED_ADMIN_PASSWORD` | ya | minimal 8 karakter |
| `SEED_ADMIN_PHONE` | tidak | boleh dikosongkan |

Seed memakai `upsert` pada email, sehingga menjalankannya berulang kali aman:
akun yang sama diperbarui, bukan digandakan.

> **Wajib sebelum dipakai pondok:** ganti `SEED_ADMIN_PASSWORD` dengan kata sandi
> asli sebelum seed dijalankan di database produksi. Nilai bawaan di `.env`
> hanya untuk pengembangan dan pengujian lokal.

---

## 8. Deploy

### 8.1 Lewat CLI

```bash
vercel deploy            # deploy preview, aman untuk uji coba
vercel deploy --prod     # deploy ke produksi
```

CLI mencetak URL hasil deploy begitu selesai.

### 8.2 Lewat Git (yang aktif di proyek ini)

Proyek Vercel `pesantren-lms` sudah tersambung ke branch `main` repositori GitHub.
Artinya:

- `git push origin main` → otomatis deploy **Production**
- push ke branch lain / pull request → otomatis deploy **Preview**

Alias `https://pesantren-lms-git-main-<scope>.vercel.app` selalu menunjuk hasil
build terakhir dari `main`.

---

## 9. Verifikasi setelah deploy

```bash
vercel ls pesantren-lms                 # daftar deploy + status Ready/Error
vercel inspect <url-deploy>             # detail satu deploy
vercel logs <url-deploy>                # log runtime
```

Uji manual di browser:

1. Buka URL produksi → halaman landing tampil.
2. `/login` → masuk dengan akun administrasi.
3. `/dashboard` → angka ringkasan terisi (bukti koneksi database hidup).
4. `/absen` → pilih mapel, ambil absen satu sesi, tekan **Ekspor CSV**.
5. `/pendaftaran` → unggah satu berkas contoh (menguji batas `bodySizeLimit` 12 MB
   di `next.config.ts`).

---

## 10. Perintah yang sering dipakai

| Tujuan | Perintah |
| --- | --- |
| Lihat status proyek | `vercel project inspect pesantren-lms` |
| Lihat daftar deploy | `vercel ls pesantren-lms` |
| Lihat log runtime | `vercel logs <url-deploy>` |
| Tambah variabel | `vercel env add <NAMA> <environment>` |
| Hapus variabel | `vercel env rm <NAMA> <environment>` |
| Tarik variabel ke lokal | `vercel env pull .env.local` |
| Kembalikan deploy lama ke produksi | `vercel rollback <url-deploy>` |
| Deploy produksi | `vercel deploy --prod` |

---

## 11. Penanganan masalah

| Gejala | Penyebab | Tindakan |
| --- | --- | --- |
| Build gagal: `DATABASE_URL belum diset…` | Pesan dari `prisma.config.ts`; variabel belum ada di environment yang sedang di-build | `vercel env add DATABASE_URL <environment>`, lalu deploy ulang |
| Build gagal saat `prisma migrate deploy`, error `P1001` | Database tidak terjangkau: string salah, `sslmode=require` hilang, atau database di-pause | Uji string dari lokal: `pnpm db:deploy` |
| Error `URL must start with postgresql://` atau adapter menolak URL | `DATABASE_URL` memakai `prisma+postgres://` (Accelerate) | Ganti dengan connection string TCP langsung (bagian 4.2) |
| Runtime error `too many connections` | Fungsi serverless membuka banyak koneksi | Tambahkan `&pool=true` pada `DATABASE_URL` |
| `Module not found: @/generated/prisma/client` | `prisma generate` tidak berjalan | Pastikan Build Command tidak di-override menjadi `next build` saja |
| Unggahan berkas ditolak `Body exceeded limit` | Berkas melebihi batas | Batas per berkas 2 MB (validasi server) dan 12 MB per aksi (`next.config.ts`) |
| Deploy naik tetapi data kosong | Database baru belum di-seed | Jalankan `pnpm db:seed` pada database pengembangan, atau buat data awal manual di produksi |
| Deploy CLI mengunggah folder yang salah | `.vercel/` dibuat di luar folder repo | Hapus `.vercel/` yang salah tempat, lalu `vercel link` ulang dari dalam folder clone |

---

## 12. Checklist serah terima

Sebelum proyek diserahkan ke pengelola pondok:

- [ ] Repositori GitHub dipindahkan / diberi akses ke akun pengelola
- [ ] Proyek Vercel dipindahkan (**Settings → General → Transfer**) atau pengelola diundang sebagai anggota tim
- [ ] Database Prisma Postgres dipindahkan ke akun Prisma milik pengelola
- [ ] `DATABASE_URL` lama dicabut dan diganti kredensial baru setelah pemindahan
- [ ] Database Preview dipisahkan dari database Production
- [ ] Kata sandi akun administrasi hasil seed diganti dengan kata sandi asli
- [ ] Domain khusus (mis. `siakad.ppiq368.sch.id`) dipasang lewat **Settings → Domains**
- [ ] Jadwal cadangan (backup) database diaktifkan dari Prisma Console
- [ ] Panduan ini beserta panduan instalasi lokal diserahkan dalam bentuk berkas

---

## Lampiran — kondisi proyek saat panduan ini ditulis

Nilai berikut adalah kondisi nyata proyek pada 28 Agustus 2026, sebagai pembanding
bila terjadi perbedaan setelah serah terima:

| Item | Nilai |
| --- | --- |
| Nama proyek Vercel | `pesantren-lms` |
| Scope | `rifki-ramdanis-projects` |
| URL produksi | `https://pesantren-lms-seven.vercel.app` |
| Root Directory | `.` |
| Framework Preset | Next.js |
| Node.js Version | 24.x |
| Sumber deploy | GitHub, branch `main` (auto-deploy aktif) |
| Database | Prisma Postgres, host `db.prisma.io:5432`, koneksi TCP langsung |
| Environment variables | `DATABASE_URL` terpasang di Production, Preview, dan Development |
