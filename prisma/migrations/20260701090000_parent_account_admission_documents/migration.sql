ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'HOMEROOM';

ALTER TABLE "User" ADD COLUMN "phone" TEXT;

ALTER TABLE "Admission" ADD COLUMN "submitterId" TEXT;
ALTER TABLE "Admission" ADD COLUMN "familyCardUrl" TEXT;
ALTER TABLE "Admission" ADD COLUMN "birthCertificateUrl" TEXT;
ALTER TABLE "Admission" ADD COLUMN "previousReportUrl" TEXT;
ALTER TABLE "Admission" ADD COLUMN "photoUrl" TEXT;

UPDATE "Admission"
SET "submitterId" = "createdParentId"
WHERE "createdParentId" IS NOT NULL;

CREATE INDEX "Admission_submitterId_idx" ON "Admission"("submitterId");

ALTER TABLE "Admission"
ADD CONSTRAINT "Admission_submitterId_fkey"
FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
