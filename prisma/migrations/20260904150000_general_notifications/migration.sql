CREATE TYPE "NotificationType" AS ENUM ('ADMISSION', 'REPORT', 'SCHEDULE', 'SYSTEM');

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keputusan pendaftaran yang sudah ada ikut masuk ke pusat notifikasi.
INSERT INTO "Notification" ("id", "userId", "type", "title", "message", "href", "readAt", "createdAt")
SELECT
    'admission-' || "id",
    "submitterId",
    'ADMISSION'::"NotificationType",
    CASE WHEN "status" = 'ACCEPTED' THEN 'Pendaftaran diterima' ELSE 'Pendaftaran ditolak' END,
    CASE
      WHEN "status" = 'ACCEPTED' THEN 'Pendaftaran ' || "childName" || ' diterima. Buka untuk melihat NIS dan catatan administrasi.'
      ELSE 'Pendaftaran ' || "childName" || ' belum dapat diterima. Buka untuk melihat catatan administrasi.'
    END,
    '/anak#status-pendaftaran',
    "notificationReadAt",
    COALESCE("reviewedAt", "updatedAt")
FROM "Admission"
WHERE "submitterId" IS NOT NULL AND "status" IN ('ACCEPTED', 'REJECTED')
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Admission" DROP COLUMN "notificationReadAt";
