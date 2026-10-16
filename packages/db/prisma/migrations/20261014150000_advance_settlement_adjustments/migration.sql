-- Advance settlements re-apply money a student already paid, so they are not
-- new collections. Mark the existing ones as adjustments so revenue totals
-- (which only count SUCCESS) stop counting that money twice.
UPDATE "payment_transactions"
SET "status" = 'ADJUSTMENT'
WHERE "status" = 'SUCCESS'
  AND "method" = 'OTHER'
  AND "reference" LIKE 'Advance settlement for %';
