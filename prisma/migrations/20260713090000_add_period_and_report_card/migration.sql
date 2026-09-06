CREATE TYPE "Semester" AS ENUM ('GANJIL', 'GENAP');
CREATE TYPE "ReportCardStatus" AS ENUM ('DRAFT', 'PUBLISHED');

ALTER TABLE "AttendanceSession"
ADD COLUMN "semester" "Semester" NOT NULL DEFAULT 'GANJIL',
ADD COLUMN "academicYear" TEXT NOT NULL DEFAULT '2026/2027';

ALTER TABLE "GradeItem"
ADD COLUMN "semester" "Semester" NOT NULL DEFAULT 'GANJIL',
ADD COLUMN "academicYear" TEXT NOT NULL DEFAULT '2026/2027';

CREATE INDEX "AttendanceSession_academicYear_semester_idx" ON "AttendanceSession"("academicYear", "semester");
CREATE INDEX "GradeItem_academicYear_semester_idx" ON "GradeItem"("academicYear", "semester");

CREATE TABLE "ReportCard" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "semester" "Semester" NOT NULL,
    "academicYear" TEXT NOT NULL,
    "homeroomNote" TEXT,
    "status" "ReportCardStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportCardEntry" (
    "id" TEXT NOT NULL,
    "reportCardId" TEXT NOT NULL,
    "courseId" TEXT,
    "courseTitle" TEXT NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "present" INTEGER NOT NULL DEFAULT 0,
    "late" INTEGER NOT NULL DEFAULT 0,
    "absent" INTEGER NOT NULL DEFAULT 0,
    "excused" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReportCardEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportCard_studentId_semester_academicYear_key" ON "ReportCard"("studentId", "semester", "academicYear");
CREATE INDEX "ReportCard_status_idx" ON "ReportCard"("status");
CREATE INDEX "ReportCard_academicYear_semester_idx" ON "ReportCard"("academicYear", "semester");
CREATE UNIQUE INDEX "ReportCardEntry_reportCardId_courseTitle_key" ON "ReportCardEntry"("reportCardId", "courseTitle");
CREATE INDEX "ReportCardEntry_courseId_idx" ON "ReportCardEntry"("courseId");

ALTER TABLE "ReportCard"
ADD CONSTRAINT "ReportCard_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportCard"
ADD CONSTRAINT "ReportCard_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReportCardEntry"
ADD CONSTRAINT "ReportCardEntry_reportCardId_fkey"
FOREIGN KEY ("reportCardId") REFERENCES "ReportCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
