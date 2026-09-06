-- Jadwal sekarang wajib memiliki waktu selesai dan ruangan. Slot lama diberi
-- durasi satu jam serta penanda ruangan agar migrasi tetap aman untuk data yang
-- sudah tersimpan.
ALTER TABLE "ScheduleSlot" ADD COLUMN "endTime" TEXT;

UPDATE "ScheduleSlot"
SET "endTime" = to_char(replace("startTime", '.', ':')::time + interval '1 hour', 'HH24:MI'),
    "room" = COALESCE(NULLIF(BTRIM("room"), ''), 'Belum ditentukan');

ALTER TABLE "ScheduleSlot" ALTER COLUMN "endTime" SET NOT NULL;
ALTER TABLE "ScheduleSlot" ALTER COLUMN "room" SET NOT NULL;

-- Kode daftar adalah identitas proses PPDB. NIS tetap berada di
-- StudentProfile.studentNumber dan baru tersedia setelah pendaftaran diterima.
ALTER TABLE "Admission" ADD COLUMN "registrationCode" TEXT;
ALTER TABLE "Admission" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "Admission" ADD COLUMN "notificationReadAt" TIMESTAMP(3);

UPDATE "Admission"
SET "registrationCode" = 'REG-' || to_char("createdAt", 'YYYY') || '-' || upper(substr(replace("id", '-', ''), 1, 8));

ALTER TABLE "Admission" ALTER COLUMN "registrationCode" SET NOT NULL;
CREATE UNIQUE INDEX "Admission_registrationCode_key" ON "Admission"("registrationCode");

-- Kolom Amanah tidak lagi digunakan pada laporan BKKH.
ALTER TABLE "BkkhReport" DROP COLUMN "assignment";
