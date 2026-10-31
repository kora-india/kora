-- Fee imports: a school's earlier records brought into the app. An opening
-- balance is what each student owes or holds in advance on one date. Bills
-- and credits keep their import's id so the whole upload can be undone.

-- AlterTable
ALTER TABLE "fee_charges" ADD COLUMN     "importId" TEXT;

-- AlterTable
ALTER TABLE "advance_ledgers" ADD COLUMN     "importId" TEXT;

-- CreateTable
CREATE TABLE "fee_imports" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OPENING_BALANCE',
    "sessionId" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "fileName" TEXT,
    "studentCount" INTEGER NOT NULL,
    "totalDues" DECIMAL(14,2) NOT NULL,
    "totalAdvance" DECIMAL(14,2) NOT NULL,
    "chargedComponentIds" TEXT[],
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "undoneAt" TIMESTAMP(3),
    "undoneById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_import_students" (
    "studentId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,

    CONSTRAINT "fee_import_students_pkey" PRIMARY KEY ("studentId")
);

-- CreateIndex
CREATE INDEX "fee_imports_schoolId_createdAt_idx" ON "fee_imports"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "fee_import_students_importId_idx" ON "fee_import_students"("importId");

-- CreateIndex
CREATE INDEX "fee_charges_importId_idx" ON "fee_charges"("importId");

-- CreateIndex
CREATE INDEX "advance_ledgers_importId_idx" ON "advance_ledgers"("importId");

-- AddForeignKey
ALTER TABLE "fee_imports" ADD CONSTRAINT "fee_imports_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_import_students" ADD CONSTRAINT "fee_import_students_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_import_students" ADD CONSTRAINT "fee_import_students_importId_fkey" FOREIGN KEY ("importId") REFERENCES "fee_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

