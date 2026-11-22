-- A student's PAN and APAAR ID, both optional.
ALTER TABLE "students" ADD COLUMN "panNumber" TEXT;
ALTER TABLE "students" ADD COLUMN "apaarId" TEXT;

-- Each belongs to one student within a school. NULLs don't clash, so any
-- number of students can leave them blank.
CREATE UNIQUE INDEX "students_schoolId_panNumber_key" ON "students"("schoolId", "panNumber");
CREATE UNIQUE INDEX "students_schoolId_apaarId_key" ON "students"("schoolId", "apaarId");
