-- Year-end promotion history: where each student was before a promotion, so
-- past classes are on record and the latest promotion can be undone.

-- CreateEnum
CREATE TYPE "PromotionAction" AS ENUM ('PROMOTED', 'REPEATED', 'STAYED', 'GRADUATED', 'LEFT');

-- CreateTable
CREATE TABLE "student_promotions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "action" "PromotionAction" NOT NULL,
    "fromClassId" TEXT NOT NULL,
    "fromSectionId" TEXT NOT NULL,
    "fromRollNumber" TEXT NOT NULL,
    "toClassId" TEXT NOT NULL,
    "toSectionId" TEXT NOT NULL,
    "toRollNumber" TEXT NOT NULL,
    "cancelledTransportIds" TEXT[],
    "sessionId" TEXT,
    "createdById" TEXT,
    "undoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_promotions_schoolId_batchId_idx" ON "student_promotions"("schoolId", "batchId");

-- CreateIndex
CREATE INDEX "student_promotions_studentId_idx" ON "student_promotions"("studentId");

-- AddForeignKey
ALTER TABLE "student_promotions" ADD CONSTRAINT "student_promotions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_promotions" ADD CONSTRAINT "student_promotions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

