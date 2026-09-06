CREATE INDEX "User_verifiedAt_idx" ON "User"("verifiedAt");

CREATE INDEX "Lesson_createdAt_idx" ON "Lesson"("createdAt");
CREATE INDEX "Lesson_deletedAt_createdAt_idx" ON "Lesson"("deletedAt", "createdAt");

CREATE INDEX "AttendanceSession_heldAt_idx" ON "AttendanceSession"("heldAt");
CREATE INDEX "AttendanceSession_createdAt_idx" ON "AttendanceSession"("createdAt");

CREATE INDEX "GradeItem_dueAt_idx" ON "GradeItem"("dueAt");
CREATE INDEX "GradeItem_createdAt_idx" ON "GradeItem"("createdAt");
