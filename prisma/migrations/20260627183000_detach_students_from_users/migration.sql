-- Drop the old user-role default so new accounts must be explicit staff/parent roles.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

-- Keep santri data on StudentProfile before detaching it from login accounts.
ALTER TABLE "StudentProfile" ADD COLUMN "name" TEXT;

UPDATE "StudentProfile" sp
SET "name" = u."name"
FROM "User" u
WHERE sp."userId" = u."id";

ALTER TABLE "StudentProfile" ALTER COLUMN "name" SET NOT NULL;

-- Admissions used to store the generated student user id. Point them to StudentProfile.id.
UPDATE "Admission" a
SET "createdStudentId" = sp."id"
FROM "StudentProfile" sp
WHERE a."createdStudentId" = sp."userId";

-- Move all student-owned records from User.id to StudentProfile.id.
ALTER TABLE "Enrollment" ADD COLUMN "studentId" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "studentId" TEXT;
ALTER TABLE "GradeRecord" ADD COLUMN "studentId" TEXT;

UPDATE "Enrollment" e
SET "studentId" = sp."id"
FROM "StudentProfile" sp
WHERE e."userId" = sp."userId";

UPDATE "AttendanceRecord" ar
SET "studentId" = sp."id"
FROM "StudentProfile" sp
WHERE ar."userId" = sp."userId";

UPDATE "GradeRecord" gr
SET "studentId" = sp."id"
FROM "StudentProfile" sp
WHERE gr."userId" = sp."userId";

ALTER TABLE "Enrollment" ALTER COLUMN "studentId" SET NOT NULL;
ALTER TABLE "AttendanceRecord" ALTER COLUMN "studentId" SET NOT NULL;
ALTER TABLE "GradeRecord" ALTER COLUMN "studentId" SET NOT NULL;

-- Replace constraints and indexes that used userId for santri data.
ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_userId_fkey";
ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_userId_courseId_key";
DROP INDEX IF EXISTS "Enrollment_userId_courseId_key";

ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_userId_fkey";
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_attendanceSessionId_userId_key";
DROP INDEX IF EXISTS "AttendanceRecord_attendanceSessionId_userId_key";
DROP INDEX IF EXISTS "AttendanceRecord_userId_idx";

ALTER TABLE "GradeRecord" DROP CONSTRAINT IF EXISTS "GradeRecord_userId_fkey";
ALTER TABLE "GradeRecord" DROP CONSTRAINT IF EXISTS "GradeRecord_gradeItemId_userId_key";
DROP INDEX IF EXISTS "GradeRecord_gradeItemId_userId_key";
DROP INDEX IF EXISTS "GradeRecord_userId_idx";

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Enrollment_studentId_courseId_key" ON "Enrollment"("studentId", "courseId");
CREATE UNIQUE INDEX "AttendanceRecord_attendanceSessionId_studentId_key" ON "AttendanceRecord"("attendanceSessionId", "studentId");
CREATE INDEX "AttendanceRecord_studentId_idx" ON "AttendanceRecord"("studentId");
CREATE UNIQUE INDEX "GradeRecord_gradeItemId_studentId_key" ON "GradeRecord"("gradeItemId", "studentId");
CREATE INDEX "GradeRecord_studentId_idx" ON "GradeRecord"("studentId");

-- StudentProfile no longer belongs to a login account.
ALTER TABLE "StudentProfile" DROP CONSTRAINT IF EXISTS "StudentProfile_userId_fkey";
DROP INDEX IF EXISTS "StudentProfile_userId_key";
ALTER TABLE "StudentProfile" DROP COLUMN "userId";

ALTER TABLE "Enrollment" DROP COLUMN "userId";
ALTER TABLE "AttendanceRecord" DROP COLUMN "userId";
ALTER TABLE "GradeRecord" DROP COLUMN "userId";

CREATE INDEX "StudentProfile_name_idx" ON "StudentProfile"("name");

-- Remove obsolete santri login accounts. The enum value can stay in PostgreSQL;
-- Prisma no longer exposes it and no rows should use it after this migration.
DELETE FROM "Session"
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "role" = 'STUDENT');

DELETE FROM "User" WHERE "role" = 'STUDENT';
