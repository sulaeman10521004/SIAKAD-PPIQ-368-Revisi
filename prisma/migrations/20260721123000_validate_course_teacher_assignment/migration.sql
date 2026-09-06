-- Remove legacy assignments that do not point to verified academic staff.
-- Administrasi can see these courses as unassigned and must choose a valid ustadz
-- before academic staff can manage their grades or attendance.
UPDATE "Course" AS course
SET "teacherId" = NULL
FROM "User" AS account
WHERE course."teacherId" = account."id"
  AND (
    account."role" NOT IN ('TEACHER', 'HOMEROOM')
    OR account."status" <> 'VERIFIED'
  );
