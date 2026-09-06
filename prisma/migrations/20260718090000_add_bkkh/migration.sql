-- CreateTable
CREATE TABLE "BkkhActivity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BkkhActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BkkhRecord" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BkkhRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BkkhActivity_active_order_idx" ON "BkkhActivity"("active", "order");

-- CreateIndex
CREATE UNIQUE INDEX "BkkhRecord_activityId_teacherId_date_key" ON "BkkhRecord"("activityId", "teacherId", "date");

-- CreateIndex
CREATE INDEX "BkkhRecord_teacherId_date_idx" ON "BkkhRecord"("teacherId", "date");

-- CreateIndex
CREATE INDEX "BkkhRecord_date_idx" ON "BkkhRecord"("date");

-- AddForeignKey
ALTER TABLE "BkkhRecord" ADD CONSTRAINT "BkkhRecord_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "BkkhActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BkkhRecord" ADD CONSTRAINT "BkkhRecord_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
