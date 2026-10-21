-- P6: the monthly fee cron records the billing month it last finished for
-- each school, so a run cut short by the time limit carries on with the
-- schools still to do instead of stopping after the first batch.
ALTER TABLE "schools" ADD COLUMN "lastAutoFeePeriod" TEXT;
