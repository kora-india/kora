-- Past attendance brought in from a filled template, one section at a time.
CREATE TABLE "attendance_imports" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,
    "fromMonth" TEXT NOT NULL,
    "toMonth" TEXT NOT NULL,
    "fileName" TEXT,
    "studentCount" INTEGER NOT NULL,
    "dayCount" INTEGER NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "undoneAt" TIMESTAMP(3),
    "undoneById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_imports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_imports_schoolId_createdAt_idx" ON "attendance_imports"("schoolId", "createdAt");

ALTER TABLE "attendance_imports" ADD CONSTRAINT "attendance_imports_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Which import a record came from. Cleared when someone changes the record, so
-- undoing the import can't take away their correction.
ALTER TABLE "attendances" ADD COLUMN "importId" TEXT;

CREATE INDEX "attendances_importId_idx" ON "attendances"("importId");

ALTER TABLE "attendances" ADD CONSTRAINT "attendances_importId_fkey" FOREIGN KEY ("importId") REFERENCES "attendance_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
