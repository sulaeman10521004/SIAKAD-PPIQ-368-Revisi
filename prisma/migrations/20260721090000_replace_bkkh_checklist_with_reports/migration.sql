-- The checklist structure was based on an incorrect assumption. BKKH is a
-- manual daily report with fixed time ranges, so the old checklist data cannot
-- be mapped safely and is replaced by the actual report structure.
DROP TABLE "BkkhRecord";
DROP TABLE "BkkhActivity";

CREATE TABLE "BkkhReport" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "assignment" TEXT NOT NULL,
    "activity03000715" TEXT,
    "activity07150900" TEXT,
    "activity09301200" TEXT,
    "activity12301430" TEXT,
    "activity15301700" TEXT,
    "activity18002100" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BkkhReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BkkhReport_teacherId_date_key" ON "BkkhReport"("teacherId", "date");
CREATE INDEX "BkkhReport_date_idx" ON "BkkhReport"("date");

ALTER TABLE "BkkhReport" ADD CONSTRAINT "BkkhReport_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
