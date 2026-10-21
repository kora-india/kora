-- Section 8 (product & UX).

-- U3: a setup order keeps the paid-for subdomain reserved, and a payment that
-- arrives before the school exists is recorded (PAID) so creation can be
-- retried with it. U2: renewals and trial conversions use RENEWAL orders.
ALTER TABLE "subscription_orders" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'SETUP';
ALTER TABLE "subscription_orders" ADD COLUMN "subdomain" TEXT;
CREATE INDEX "subscription_orders_subdomain_idx" ON "subscription_orders"("subdomain");

-- Orders that already created a school were marked PAID; PAID now means
-- "paid, school not created yet", so mark those COMPLETED.
UPDATE "subscription_orders"
SET "status" = 'COMPLETED'
WHERE "status" = 'PAID' AND "schoolId" IS NOT NULL;

-- U1: plans allow the student numbers setup promised (Basic 500, Pro 2,000).
-- Rows set higher by hand are left alone.
UPDATE "plan_limits" SET "maxStudents" = 500 WHERE "plan" = 'BASIC' AND "maxStudents" < 500;
UPDATE "plan_limits" SET "maxStudents" = 2000 WHERE "plan" = 'PRO' AND "maxStudents" < 2000;

-- U6: setup saved time zones as "Asia/Kolkata (IST)"; keep the IANA name.
UPDATE "schools"
SET "timezone" = regexp_replace("timezone", '\s*\(.*\)\s*$', '')
WHERE "timezone" ~ '\(.*\)\s*$';

-- U6: setup saved a hidden default ("Percentage (0 - 100)") as free text; it
-- was never a choice, so clear anything that isn't an exam grading system.
UPDATE "schools"
SET "gradingSystem" = NULL
WHERE "gradingSystem" IS NOT NULL
  AND "gradingSystem" NOT IN ('CBSE_9_POINT', 'PERCENTAGE_LETTER', 'MARKS_ONLY');

-- U6: setup numbered classes by position (Nursery = 1, LKG = 2, ...); the
-- class catalogue uses Nursery = -2, LKG = -1, UKG = 0, Class N = N, which
-- is what classes added later get, so the two now sort together.
UPDATE "classes" SET "grade" = -2 WHERE "name" = 'Nursery';
UPDATE "classes" SET "grade" = -1 WHERE "name" = 'LKG';
UPDATE "classes" SET "grade" = 0 WHERE "name" = 'UKG';
UPDATE "classes"
SET "grade" = substring("name" from '^Class (\d{1,2})$')::int
WHERE "name" ~ '^Class \d{1,2}$';
