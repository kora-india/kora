-- AlterTable
ALTER TABLE "users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
