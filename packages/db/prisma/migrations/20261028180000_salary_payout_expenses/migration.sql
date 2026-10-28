-- Salary payouts are now also recorded as expenses (payroll.ts), because the
-- ledger, dashboard and analytics count money out from expenses. This records
-- the payouts made before that change. Run twice, it adds nothing new.

INSERT INTO "expense_categories" ("id", "schoolId", "name", "description", "createdAt", "updatedAt")
SELECT DISTINCT ON (pp."schoolId")
       'c' || substr(md5(random()::text || pp."schoolId"), 1, 24),
       pp."schoolId", 'Salaries', 'Teacher salary payouts, recorded by payroll',
       NOW(), NOW()
FROM "payroll_payouts" pp
WHERE pp."status" = 'SUCCEEDED'
ON CONFLICT ("schoolId", "name") DO NOTHING;

INSERT INTO "expenses" ("id", "schoolId", "categoryId", "amount", "date", "title",
                        "description", "paymentMethod", "referenceNo", "recordedById",
                        "createdAt", "updatedAt")
SELECT 'c' || substr(md5(random()::text || pp."id"), 1, 24),
       pp."schoolId", ec."id", pp."amount", COALESCE(pp."processedAt", pp."createdAt"),
       'Salary: ' || t."name" || ', ' || to_char(make_date(ss."year", ss."month", 1), 'FMMonth YYYY'),
       'Payout ' || pp."transactionId" || ' for slip ' || ss."slipNumber",
       pp."method", pp."transactionId", u."id", NOW(), NOW()
FROM "payroll_payouts" pp
JOIN "salary_slips" ss ON ss."id" = pp."salarySlipId"
JOIN "teachers" t ON t."id" = ss."teacherId"
JOIN "expense_categories" ec ON ec."schoolId" = pp."schoolId" AND ec."name" = 'Salaries'
LEFT JOIN "users" u ON u."id" = pp."processedById"
WHERE pp."status" = 'SUCCEEDED'
  AND NOT EXISTS (
    SELECT 1 FROM "expenses" e
    WHERE e."schoolId" = pp."schoolId" AND e."referenceNo" = pp."transactionId"
  );
