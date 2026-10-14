-- AlterTable schools
ALTER TABLE "schools" ADD COLUMN "receiptPrefix" TEXT DEFAULT 'RCP';
ALTER TABLE "schools" ADD COLUMN "receiptFormat" TEXT DEFAULT '{PREFIX}-{YYYY}-{SEQ:5}';
ALTER TABLE "schools" ADD COLUMN "nextReceiptNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "schools" ADD COLUMN "autoFeeGeneration" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "schools" ADD COLUMN "maxLateFeeCap" DECIMAL(10, 2);

-- AlterTable fees
ALTER TABLE "fees" ADD COLUMN "isMigrated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "fees" ADD COLUMN "migratedChargeId" TEXT;

-- AlterTable fee_charges
ALTER TABLE "fee_charges" ADD COLUMN "periodKey" TEXT;
CREATE UNIQUE INDEX "fee_charges_studentId_sessionId_periodKey_key" ON "fee_charges"("studentId", "sessionId", "periodKey");

-- AlterTable fee_charge_items
ALTER TABLE "fee_charge_items" ADD COLUMN "waivedBy" TEXT;
ALTER TABLE "fee_charge_items" ADD COLUMN "waivedAt" TIMESTAMP(3);
ALTER TABLE "fee_charge_items" ADD COLUMN "waiverReason" TEXT;

-- AlterTable payment_transactions
DROP INDEX IF EXISTS "payment_transactions_receiptNo_key";
ALTER TABLE "payment_transactions" ADD COLUMN "receiptSnapshot" JSONB;
ALTER TABLE "payment_transactions" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "payment_transactions_schoolId_receiptNo_key" ON "payment_transactions"("schoolId", "receiptNo");
CREATE UNIQUE INDEX "payment_transactions_schoolId_idempotencyKey_key" ON "payment_transactions"("schoolId", "idempotencyKey");
