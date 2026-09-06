-- Separate the account that created a course from the ustadz assigned to teach it.
ALTER TABLE "Course" ADD COLUMN "teacherId" TEXT;

-- Preserve existing assignments when the old creator field points to academic staff.
UPDATE "Course" AS course
SET "teacherId" = course."createdById"
FROM "User" AS account
WHERE course."createdById" = account."id"
  AND account."role" IN ('TEACHER', 'HOMEROOM');

CREATE INDEX "Course_teacherId_idx" ON "Course"("teacherId");

ALTER TABLE "Course"
ADD CONSTRAINT "Course_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
