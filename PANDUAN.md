# Frog Quest: panduan end-to-end

Urutan: **A. Siapkan akun → B. Supabase → C. Resend → D. GitHub → E. Vercel → F. Jadwal reminder → G. Tes → H. Kalau error**.
Total sekitar 30 menit. Yang perlu lu catat di notes selama proses: Project URL, anon key, service_role key, API key Resend, dan CRON_SECRET.

## A. Siapkan akun
- GitHub (github.com), Supabase (supabase.com), Resend (resend.com), Vercel (vercel.com, login pakai akun GitHub).
- Daftar Resend pakai **email yang mau lu pakai buat nerima laporan**. Ini penting (lihat bagian C).

## B. Supabase
1. **New project**: nama `frog-quest`, buat password database (simpan), region **Singapore**. Tunggu sampai selesai.
2. **SQL Editor → New query**, paste seluruh isi `supabase.sql`, **Run**. Harus muncul Success.
3. **Authentication → Users → Add user → Create new user**: isi email dan password lu, centang **Auto Confirm User**. Ini akun login web.
4. Di pengaturan Authentication, matikan **Allow new users to sign up**.
5. **Project Settings → API** (atau API Keys): catat **Project URL**, **anon key**, **service_role key**.
6. **Database → Extensions**: aktifkan **pg_cron** dan **pg_net**.

## C. Resend
1. **API Keys → Create API Key** (Sending access). Salin, ini `RESEND_API_KEY`.
2. Tanpa domain sendiri, email hanya bisa dikirim dari `onboarding@resend.dev` ke **email akun Resend lu**. Cukup untuk pemakaian pribadi. Email tujuan di pengaturan web harus sama dengan email akun Resend.

## D. GitHub (upload dan commit)
1. Buat repo baru: **New repository**, nama `frog-quest`, Private, **tanpa** README. Klik Create.
2. Di halaman repo kosong, klik **uploading an existing file**.
3. **Dari laptop:** drag semua file dan folder `api` sekaligus. **Dari HP:** folder tidak bisa diupload, pakai cara file satu-satu di langkah 6.
4. Sebelum commit, pastikan struktur akhirnya begini (nama harus persis):
```
index.html
config.js
package.json
api/_lib.js
api/notify.js
api/cron.js
```
   `supabase.sql` dan `PANDUAN.md` boleh ikut. Jangan upload zip (GitHub tidak mengekstraknya).
5. Di bawah, kolom **Commit changes** isi pesan `first commit`, pilih **Commit directly to the main branch**, klik **Commit changes**. Itu yang dimaksud commit: menyimpan file ke repo.
6. **Cara HP / file satu-satu:** **Add file → Create new file**. Di kolom nama ketik `api/notify.js` (mengetik `/` otomatis membuat folder `api`), paste isi file, **Commit changes**. Ulangi untuk setiap file.
7. **Isi config.js:** buka `config.js` di repo, klik ikon pensil, ganti `ISI_PROJECT_URL` dan `ISI_ANON_KEY` dengan nilai dari Supabase (tetap pakai tanda kutip), lalu **Commit changes**.
   Yang boleh ditaruh di sini hanya Project URL dan anon key. **service_role key jangan pernah masuk GitHub.**

## E. Vercel
1. **Add New → Project**, pilih repo `frog-quest`, **Import**.
2. Framework Preset: **Other**. Build Command, Output Directory, Install Command: biarkan kosong.
3. Buka **Environment Variables** (di halaman yang sama sebelum Deploy, atau Settings nanti), isi:

| Nama | Isi |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `RESEND_API_KEY` | key dari Resend |
| `CRON_SECRET` | kata acak panjang buatan lu, 32 karakter atau lebih |
| `APP_URL` | alamat web, misal `https://frog-quest.vercel.app` (isi setelah tahu alamatnya, lalu Redeploy) |
| `MAIL_FROM` | kosongkan kalau pakai `onboarding@resend.dev` |

4. Klik **Deploy**. Selesai, lu dapat alamat `https://nama-app.vercel.app`.
5. Kalau env baru diisi setelah deploy: **Deployments → titik tiga di deployment terbaru → Redeploy**.
6. Mulai sekarang, **setiap commit ke GitHub otomatis deploy ulang**.

## F. Jadwal reminder
Vercel gratis cuma boleh cron 1x sehari, jadi dijadwalkan dari Supabase tiap 5 menit.
1. Supabase → **SQL Editor** → jalankan (ganti `NAMA-APP` dan `ISI_CRON_SECRET`; pakai alamat production, bukan preview):
```sql
select cron.schedule('frog-reminder', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://NAMA-APP.vercel.app/api/cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ISI_CRON_SECRET',
      'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
$$);
```
2. Berhenti: `select cron.unschedule('frog-reminder');`

## G. Tes
1. Buka alamat Vercel, login pakai akun dari langkah B3.
2. ⚙︎ → isi **email** (sama dengan email Resend), pilih zona waktu → **Simpan pengaturan** → **Kirim email tes**. Email harus masuk (cek Spam juga).
3. Tambah 3 tugas, selesaikan 3-nya. Laporan masuk ke email.
4. Tes reminder: mode Rutinitas, set jam pengingat 6-10 menit dari sekarang dan hari ini dicentang, tunggu. Pastikan ada tugas yang belum selesai.
5. Cek jalannya cron di Supabase: SQL Editor → `select * from cron.job_run_details order by start_time desc limit 5;`
   Cek respon server: `select status_code, content from net._http_response order by created desc limit 5;` (200 = jalan, 401 = CRON_SECRET beda).

## H. Kalau error
- **Layar login minta isi config.js:** `config.js` belum diedit atau belum di-commit.
- **Email atau password salah:** pakai akun yang dibuat di B3, bukan akun Supabase lu.
- **Email tes gagal "Resend 403/422":** email tujuan beda dengan email akun Resend, atau `RESEND_API_KEY` salah.
- **`/api/notify` 500 "Supabase...":** `SUPABASE_URL` atau `SUPABASE_SERVICE_ROLE_KEY` di Vercel salah. Betulkan lalu Redeploy.
- **Reminder tidak datang:** cek G5. Pastikan hari ini tercentang, jam sudah lewat, masih ada tugas belum selesai, dan zona waktu benar.
- **Setelah edit file di GitHub, tampilan belum berubah:** tunggu deploy Vercel selesai (1 menit), lalu refresh keras.

## Cara kerja singkat
- **Laporan:** tiap jumlah tugas selesai hari itu kelipatan angka yang lu atur, email laporan terkirim. Semua tugas beres, dikirim laporan "semua beres".
- **Rutinitas:** hari terpilih, jam yang diatur, email berisi frog dan tugas yang belum selesai.
- **Task khusus:** email dikirim saat jam masing-masing tugas tiba.
- **Nudge:** di jam yang diatur, kalau frog belum dimakan atau belum ada tugas selesai.
- Tiap email terkirim sekali per kejadian. Tugas belum selesai pindah ke hari berikutnya. Reminder yang terlewat tetap dikirim selama masih dalam 2 jam.

## Font Unilever Shilling (opsional)
Taruh file font di repo (misal `fonts/shilling.woff2`), tambahkan di `index.html` dalam `<style>`:
```css
@font-face{font-family:"Unilever Shilling";src:url(fonts/shilling.woff2) format("woff2");}
```
