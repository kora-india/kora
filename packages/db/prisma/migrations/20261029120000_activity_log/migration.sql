-- Activity log (lib/activity.ts): sign-ins and every change people save, for
-- the school admin's Activity tab on the ledger. And who took each payment,
-- for the ledger's "Done by" column; payments before this stay NULL. Like
-- processedById, it has no foreign key, so recording it can't fail a payment.

-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "collectedById" TEXT;

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_schoolId_createdAt_idx" ON "activity_logs"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_schoolId_actorId_createdAt_idx" ON "activity_logs"("schoolId", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_schoolId_module_createdAt_idx" ON "activity_logs"("schoolId", "module", "createdAt");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
