-- CreateEnum
CREATE TYPE "AssessmentGroupKind" AS ENUM ('COURSE_SCORE', 'BEHAVIOR');

-- CreateEnum
CREATE TYPE "AdmissionDocumentKind" AS ENUM ('FAMILY_CARD', 'BIRTH_CERTIFICATE', 'PREVIOUS_REPORT', 'PHOTO');

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'SICK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportCardStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "ReportCardStatus" ADD VALUE 'APPROVED';
ALTER TYPE "ReportCardStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "assessmentGroupId" TEXT,
ADD COLUMN     "classRoomId" TEXT,
ADD COLUMN     "reportMaxScore" INTEGER;

-- AlterTable
ALTER TABLE "GradeItem" ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ReportCard" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "classNameSnapshot" TEXT,
ADD COLUMN     "excusedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "levelSnapshot" TEXT,
ADD COLUMN     "otherCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "sickCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "studentNameSnapshot" TEXT,
ADD COLUMN     "studentNumberSnapshot" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ReportCardEntry" ADD COLUMN     "groupName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "groupSortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxScore" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "scoreValue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scoreWords" TEXT NOT NULL DEFAULT '';

-- Backfill data rapor lama (best effort).
-- Rapor versi sebelumnya hanya menyimpan finalScore skala 0-100 tanpa kelompok
-- penilaian, nilai skala rapor, maupun terbilang. Tanpa backfill, rapor yang sudah
-- PUBLISHED akan tampil bernilai 0 dan tanpa huruf bagi wali santri, dan aplikasi
-- menolak menghitung ulang rapor berstatus PUBLISHED.
-- Setiap statement dibatasi hanya pada baris lama (nilai default hasil ALTER TABLE
-- di atas) agar aman dijalankan ulang.

-- scoreValue: skalakan finalScore (0-100) ke skala maxScore baris tersebut.
UPDATE "ReportCardEntry"
SET "scoreValue" = LEAST("maxScore", GREATEST(0, ROUND("finalScore" / 100.0 * "maxScore")::int))
WHERE "scoreWords" = '';

-- scoreWords: terbilang dari scoreValue. maxScore baris lama = 10, jadi 0-10 cukup.
UPDATE "ReportCardEntry"
SET "scoreWords" = CASE "scoreValue"
    WHEN 0 THEN 'Nol'
    WHEN 1 THEN 'Satu'
    WHEN 2 THEN 'Dua'
    WHEN 3 THEN 'Tiga'
    WHEN 4 THEN 'Empat'
    WHEN 5 THEN 'Lima'
    WHEN 6 THEN 'Enam'
    WHEN 7 THEN 'Tujuh'
    WHEN 8 THEN 'Delapan'
    WHEN 9 THEN 'Sembilan'
    WHEN 10 THEN 'Sepuluh'
    ELSE "scoreValue"::text
  END
WHERE "scoreWords" = '';

-- groupName: baris lama tidak punya kelompok penilaian, pakai fallback UNGROUPED_NAME
-- beserta UNGROUPED_SORT_ORDER pada lib/rapor.ts.
UPDATE "ReportCardEntry"
SET "groupName" = 'Lainnya',
    "groupSortOrder" = 999
WHERE "groupName" = '';

-- Rekap ketidakhadiran rapor: rekonstruksi best effort dari entri rapor lama.
-- Catatan: angka lama adalah jumlah per mata pelajaran, bukan jumlah hari, sehingga
-- hasilnya perkiraan. Skema lama tidak mengenal status SICK, jadi sickCount tetap 0.
UPDATE "ReportCard" rc
SET "excusedCount" = agg."excusedSum",
    "otherCount" = agg."otherSum"
FROM (
  SELECT "reportCardId",
         COALESCE(SUM("excused"), 0)::int AS "excusedSum",
         COALESCE(SUM("absent"), 0)::int + COALESCE(SUM("late"), 0)::int AS "otherSum"
  FROM "ReportCardEntry"
  GROUP BY "reportCardId"
) agg
WHERE agg."reportCardId" = rc."id"
  AND rc."sickCount" = 0
  AND rc."excusedCount" = 0
  AND rc."otherCount" = 0;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "classRoomId" TEXT;

-- CreateTable
CREATE TABLE "ClassRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "EducationLevel" NOT NULL,
    "academicYear" TEXT NOT NULL,
    "homeroomTeacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AssessmentGroupKind" NOT NULL DEFAULT 'COURSE_SCORE',
    "defaultMaxScore" INTEGER NOT NULL DEFAULT 7,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "academicYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorCriterion" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 7,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BehaviorCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCardBehaviorEntry" (
    "id" TEXT NOT NULL,
    "reportCardId" TEXT NOT NULL,
    "criterionName" TEXT NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 7,
    "scoreValue" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReportCardBehaviorEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdministrationItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "academicYear" TEXT NOT NULL,
    "semester" "Semester" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdministrationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAdministration" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fulfilled" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAdministration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AdmissionDocument" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "kind" "AdmissionDocumentKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassRoom_homeroomTeacherId_idx" ON "ClassRoom"("homeroomTeacherId");

-- CreateIndex
CREATE INDEX "ClassRoom_level_idx" ON "ClassRoom"("level");

-- CreateIndex
CREATE UNIQUE INDEX "ClassRoom_name_academicYear_key" ON "ClassRoom"("name", "academicYear");

-- CreateIndex
CREATE INDEX "AssessmentGroup_academicYear_idx" ON "AssessmentGroup"("academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentGroup_name_academicYear_key" ON "AssessmentGroup"("name", "academicYear");

-- CreateIndex
CREATE INDEX "BehaviorCriterion_groupId_idx" ON "BehaviorCriterion"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "BehaviorCriterion_groupId_name_key" ON "BehaviorCriterion"("groupId", "name");

-- CreateIndex
CREATE INDEX "ReportCardBehaviorEntry_reportCardId_idx" ON "ReportCardBehaviorEntry"("reportCardId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardBehaviorEntry_reportCardId_criterionName_key" ON "ReportCardBehaviorEntry"("reportCardId", "criterionName");

-- CreateIndex
CREATE INDEX "AdministrationItem_academicYear_semester_idx" ON "AdministrationItem"("academicYear", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "AdministrationItem_name_academicYear_semester_key" ON "AdministrationItem"("name", "academicYear", "semester");

-- CreateIndex
CREATE INDEX "StudentAdministration_itemId_idx" ON "StudentAdministration"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAdministration_studentId_itemId_key" ON "StudentAdministration"("studentId", "itemId");

-- CreateIndex
CREATE INDEX "AdmissionDocument_admissionId_idx" ON "AdmissionDocument"("admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionDocument_admissionId_kind_key" ON "AdmissionDocument"("admissionId", "kind");

-- CreateIndex
CREATE INDEX "Course_assessmentGroupId_idx" ON "Course"("assessmentGroupId");

-- CreateIndex
CREATE INDEX "Course_classRoomId_idx" ON "Course"("classRoomId");

-- CreateIndex
CREATE INDEX "ReportCard_reviewedById_idx" ON "ReportCard"("reviewedById");

-- CreateIndex
CREATE INDEX "StudentProfile_classRoomId_idx" ON "StudentProfile"("classRoomId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassRoom" ADD CONSTRAINT "ClassRoom_homeroomTeacherId_fkey" FOREIGN KEY ("homeroomTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorCriterion" ADD CONSTRAINT "BehaviorCriterion_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AssessmentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_assessmentGroupId_fkey" FOREIGN KEY ("assessmentGroupId") REFERENCES "AssessmentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_classRoomId_fkey" FOREIGN KEY ("classRoomId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardBehaviorEntry" ADD CONSTRAINT "ReportCardBehaviorEntry_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "ReportCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAdministration" ADD CONSTRAINT "StudentAdministration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAdministration" ADD CONSTRAINT "StudentAdministration_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AdministrationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDocument" ADD CONSTRAINT "AdmissionDocument_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
