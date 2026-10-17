-- Section 5 (data loss & integrity) schema changes.
--
-- D1: removing a transport route or stop no longer deletes the students
--     enrolled on it (was ON DELETE CASCADE).
-- D3: admission numbers are unique within a school instead of across every
--     school.
-- D4: roll numbers are no longer unique per class. They are per section, and
--     the student actions check them among active students only, so a
--     withdrawn student's roll number can be reused.
-- D17: deleting a student, teacher, fee component or academic session can no
--     longer erase their attendance, marks, charges, payments, advances or
--     salary slips (was ON DELETE CASCADE). Deleting a whole school therefore
--     no longer works as a plain DELETE; use purgeSchool() from @schoolos/db,
--     which removes that history first. Nothing in the app deletes schools.

-- DropForeignKey
ALTER TABLE "advance_ledgers" DROP CONSTRAINT "advance_ledgers_studentId_fkey";

-- DropForeignKey
ALTER TABLE "attendances" DROP CONSTRAINT "attendances_studentId_fkey";

-- DropForeignKey
ALTER TABLE "exam_marks" DROP CONSTRAINT "exam_marks_studentId_fkey";

-- DropForeignKey
ALTER TABLE "fee_charge_items" DROP CONSTRAINT "fee_charge_items_componentId_fkey";

-- DropForeignKey
ALTER TABLE "fee_charges" DROP CONSTRAINT "fee_charges_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "fee_charges" DROP CONSTRAINT "fee_charges_studentId_fkey";

-- DropForeignKey
ALTER TABLE "payment_transactions" DROP CONSTRAINT "payment_transactions_studentId_fkey";

-- DropForeignKey
ALTER TABLE "payroll_payouts" DROP CONSTRAINT "payroll_payouts_salarySlipId_fkey";

-- DropForeignKey
ALTER TABLE "salary_slips" DROP CONSTRAINT "salary_slips_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "student_transports" DROP CONSTRAINT "student_transports_routeId_fkey";

-- DropForeignKey
ALTER TABLE "student_transports" DROP CONSTRAINT "student_transports_stopId_fkey";

-- DropIndex
DROP INDEX "students_admissionNumber_key";

-- DropIndex
DROP INDEX "students_schoolId_rollNumber_classId_key";

-- CreateIndex
CREATE INDEX "students_sectionId_rollNumber_idx" ON "students"("sectionId", "rollNumber");

-- CreateIndex
CREATE UNIQUE INDEX "students_schoolId_admissionNumber_key" ON "students"("schoolId", "admissionNumber");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_charges" ADD CONSTRAINT "fee_charges_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_charges" ADD CONSTRAINT "fee_charges_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_charge_items" ADD CONSTRAINT "fee_charge_items_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "fee_components"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_ledgers" ADD CONSTRAINT "advance_ledgers_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transports" ADD CONSTRAINT "student_transports_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transports" ADD CONSTRAINT "student_transports_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "route_stops"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payouts" ADD CONSTRAINT "payroll_payouts_salarySlipId_fkey" FOREIGN KEY ("salarySlipId") REFERENCES "salary_slips"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

