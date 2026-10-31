-- A staff record can carry a login, so an accountant is one person rather than
-- a staff card in one place and a login in another.
ALTER TABLE "staff" ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "staff_userId_key" ON "staff"("userId");

ALTER TABLE "staff" ADD CONSTRAINT "staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An accountant login with a staff card under the same email is that person.
UPDATE "staff" AS s
SET "userId" = m."userId"
FROM (
  SELECT DISTINCT ON (u."id") u."id" AS "userId", st."id" AS "staffId"
  FROM "users" AS u
  JOIN "staff" AS st
    ON st."schoolId" = u."schoolId"
   AND st."isActive" = true
   AND lower(st."email") = lower(u."email")
  WHERE u."role" = 'ACCOUNTANT' AND u."isActive" = true
  ORDER BY u."id", st."createdAt"
) AS m
WHERE s."id" = m."staffId";

-- Every other accountant login gets a staff card. No login is created for a
-- staff card that has none: that would email someone without being asked.
INSERT INTO "staff" ("id", "schoolId", "name", "phone", "occupation", "email", "userId", "joiningDate", "updatedAt")
SELECT 'staff_' || u."id", u."schoolId", u."name", COALESCE(u."phone", ''), 'Accountant', u."email", u."id", u."createdAt", CURRENT_TIMESTAMP
FROM "users" AS u
WHERE u."role" = 'ACCOUNTANT'
  AND u."isActive" = true
  AND u."schoolId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "staff" AS st WHERE st."userId" = u."id");
