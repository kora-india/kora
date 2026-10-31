-- Full fee history: payments can come from an import too, and an import keeps
-- its totals and how late fees are treated for its months.

-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "importId" TEXT;

-- AlterTable
ALTER TABLE "fee_imports" ADD COLUMN     "billCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "calculateLateFees" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "continueLateFees" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DONE',
ADD COLUMN     "totalBilled" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalLateFees" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalPaid" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "payment_transactions_importId_idx" ON "payment_transactions"("importId");

