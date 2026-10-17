import type { PrismaClient } from "@prisma/client";

/**
 * Permanently deletes a school and everything in it.
 *
 * Financial and academic history (payments, charges, advances, marks,
 * attendance, salary slips) can't be removed by deleting a single student,
 * teacher, fee component or session (ON DELETE NO ACTION, D17). Postgres
 * checks those constraints after each cascaded delete, so a plain
 * `school.delete()` fails on rows the cascade hasn't reached yet. This deletes
 * those rows first, then the school, in one transaction.
 *
 * Nothing in the app deletes schools; this is for tests, seeds and support.
 */
export async function purgeSchool(
  db: PrismaClient,
  schoolId: string,
): Promise<void> {
  await db.$transaction([
    db.paymentAllocation.deleteMany({ where: { payment: { schoolId } } }),
    db.paymentAllocation.deleteMany({
      where: { chargeItem: { charge: { schoolId } } },
    }),
    db.paymentTransaction.deleteMany({ where: { schoolId } }),
    db.payment.deleteMany({ where: { schoolId } }),
    db.advanceLedger.deleteMany({ where: { student: { schoolId } } }),
    db.feeChargeItem.deleteMany({ where: { charge: { schoolId } } }),
    db.feeChargeItem.deleteMany({ where: { component: { schoolId } } }),
    db.feeCharge.deleteMany({ where: { schoolId } }),
    db.examMark.deleteMany({ where: { student: { schoolId } } }),
    db.attendance.deleteMany({ where: { schoolId } }),
    db.studentTransport.deleteMany({ where: { schoolId } }),
    db.payrollPayout.deleteMany({ where: { schoolId } }),
    db.salarySlip.deleteMany({ where: { schoolId } }),
    // No cascade is defined from schools to these.
    db.expense.deleteMany({ where: { schoolId } }),
    db.expenseCategory.deleteMany({ where: { schoolId } }),
    db.school.deleteMany({ where: { id: schoolId } }),
  ]);
}
