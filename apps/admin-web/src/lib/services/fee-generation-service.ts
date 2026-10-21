import "server-only";

import { prisma, FeeStatus } from "@schoolos/db";
import {
  billingBucket,
  formatPeriodLabel,
  isComponentDue,
  isPeriodKey,
  isPeriodWithinSession,
  parsePeriodKey,
  periodKeyFromDate,
} from "@/lib/fees/billing-period";
import { findOrCreateTransportComponent } from "@/lib/fees/transport-component";

const roundMoney = (n: number) => Math.round(n * 100) / 100;

/** Status of PaymentTransactions that move a student's own advance onto a new charge. */
export const ADJUSTMENT_STATUS = "ADJUSTMENT";

export interface BillingPeriodInput {
  /** Billing month, "YYYY-MM". Duplicate generation is detected by this key. */
  periodKey: string;
  title: string;
  dueDate: Date;
}

function createCuid(): string {
  return (
    "c" +
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10) +
    Math.random().toString(36).substring(2, 6)
  );
}

export async function processClassFeeGeneration(
  schoolId: string,
  sessionId: string,
  classId: string,
  period: BillingPeriodInput,
) {
  const { periodKey, title, dueDate } = period;
  const parsedPeriod = parsePeriodKey(periodKey);
  if (!parsedPeriod) return { error: `Invalid billing month "${periodKey}"` };
  if (isNaN(dueDate.getTime())) return { error: "Invalid due date" };

  const periodStart = new Date(
    Date.UTC(parsedPeriod.year, parsedPeriod.month - 1, 1),
  );
  const nextPeriodStart = new Date(
    Date.UTC(parsedPeriod.year, parsedPeriod.month, 1),
  );

  try {
    const session = await prisma.academicSession.findFirst({
      where: { id: sessionId, schoolId },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    if (!session) return { error: "Academic session not found" };
    if (!isPeriodWithinSession(periodKey, session.startDate, session.endDate)) {
      return {
        error: `${formatPeriodLabel(periodKey)} is outside the ${session.name} session`,
      };
    }

    const students = await prisma.student.findMany({
      where: { classId, schoolId, isActive: true },
      select: { id: true },
    });
    if (students.length === 0)
      return { error: "No active students in this class" };

    // B3: the structure must belong to this school and session, and be active.
    const classStructure = await prisma.classFeeStructure.findFirst({
      where: {
        classId,
        structure: { schoolId, sessionId, status: "ACTIVE" },
      },
      orderBy: { createdAt: "desc" },
      include: {
        structure: {
          include: { items: { include: { component: true } } },
        },
      },
    });
    if (!classStructure)
      return {
        error:
          "No active fee structure assigned to this class for the selected session",
      };

    const studentIds = students.map((s) => s.id);
    const transports = await prisma.studentTransport.findMany({
      where: { studentId: { in: studentIds }, sessionId, status: "ACTIVE" },
      select: { studentId: true, monthlyFee: true },
    });
    // Resolved before the transaction: creating it can race on the unique name.
    const transportComp = transports.some((t) => Number(t.monthlyFee) > 0)
      ? await findOrCreateTransportComponent(schoolId)
      : null;

    let generatedCount = 0;
    let alreadyGenerated = 0;

    await prisma.$transaction(
      async (tx) => {
        // B2: a charge for this month already exists if it carries the period
        // key, or (for charges created before period keys) its due date falls
        // in the month.
        const existingCharges = await tx.feeCharge.findMany({
          where: {
            studentId: { in: studentIds },
            sessionId,
            OR: [
              { periodKey },
              {
                periodKey: null,
                dueDate: { gte: periodStart, lt: nextPeriodStart },
              },
            ],
          },
          select: { studentId: true },
        });
        const existingStudentIds = new Set(
          existingCharges.map((c) => c.studentId),
        );
        alreadyGenerated = existingStudentIds.size;

        const eligibleIds = studentIds.filter(
          (id) => !existingStudentIds.has(id),
        );
        if (eligibleIds.length === 0) return;

        const [overrides, ledgers] = await Promise.all([
          tx.studentFeeOverride.findMany({
            where: { studentId: { in: eligibleIds }, sessionId },
          }),
          tx.advanceLedger.findMany({
            where: { studentId: { in: eligibleIds } },
          }),
        ]);

        // Components that may be billed: the structure's plus any extra
        // components given to individual students through overrides.
        const structureCompIds = new Set(
          classStructure.structure.items.map((i) => i.componentId),
        );
        const extraCompIds = [
          ...new Set(
            overrides
              .map((o) => o.componentId)
              .filter((id) => !structureCompIds.has(id)),
          ),
        ];
        const extraComponents = await tx.feeComponent.findMany({
          where: { id: { in: extraCompIds }, schoolId },
        });
        const frequencyByComp = new Map<string, string>();
        for (const item of classStructure.structure.items) {
          frequencyByComp.set(item.componentId, item.component.frequency);
        }
        for (const c of extraComponents) frequencyByComp.set(c.id, c.frequency);
        if (transportComp) frequencyByComp.set(transportComp.id, "MONTHLY");

        // B1: which billing buckets each student has already been charged
        // for, per component. Session charges cover MONTHLY to YEARLY;
        // ONE_TIME components count across every session.
        const oneTimeCompIds = [...frequencyByComp.entries()]
          .filter(([, f]) => f === "ONE_TIME")
          .map(([id]) => id);
        const [sessionItems, lifetimeOneTimeItems] = await Promise.all([
          tx.feeChargeItem.findMany({
            where: {
              charge: { studentId: { in: eligibleIds }, sessionId },
            },
            select: {
              componentId: true,
              charge: {
                select: { studentId: true, periodKey: true, dueDate: true },
              },
            },
          }),
          oneTimeCompIds.length > 0
            ? tx.feeChargeItem.findMany({
                where: {
                  componentId: { in: oneTimeCompIds },
                  charge: { studentId: { in: eligibleIds } },
                },
                select: {
                  componentId: true,
                  charge: { select: { studentId: true } },
                },
              })
            : Promise.resolve([]),
        ]);

        const billed = new Map<string, Set<string>>();
        const markBilled = (
          studentId: string,
          compId: string,
          bucket: string,
        ) => {
          const key = `${studentId}:${compId}`;
          if (!billed.has(key)) billed.set(key, new Set());
          billed.get(key)!.add(bucket);
        };
        for (const item of sessionItems) {
          const frequency = frequencyByComp.get(item.componentId);
          if (!frequency) continue;
          const chargePeriod = isPeriodKey(item.charge.periodKey)
            ? item.charge.periodKey
            : periodKeyFromDate(item.charge.dueDate);
          const bucket = billingBucket(
            frequency,
            session.startDate,
            chargePeriod,
          );
          if (bucket)
            markBilled(item.charge.studentId, item.componentId, bucket);
        }
        for (const item of lifetimeOneTimeItems) {
          markBilled(item.charge.studentId, item.componentId, "ONCE");
        }
        const isDue = (studentId: string, compId: string, frequency: string) =>
          isComponentDue(
            frequency,
            session.startDate,
            periodKey,
            billed.get(`${studentId}:${compId}`) ?? new Set(),
          );

        const overridesByStudent = new Map<string, typeof overrides>();
        for (const o of overrides) {
          if (!overridesByStudent.has(o.studentId))
            overridesByStudent.set(o.studentId, []);
          overridesByStudent.get(o.studentId)!.push(o);
        }
        const transportByStudent = new Map(
          transports.map((t) => [t.studentId, t]),
        );
        const ledgersByStudent = new Map<string, typeof ledgers>();
        for (const l of ledgers) {
          if (!ledgersByStudent.has(l.studentId))
            ledgersByStudent.set(l.studentId, []);
          ledgersByStudent.get(l.studentId)!.push(l);
        }
        const extraCompMap = new Map(extraComponents.map((c) => [c.id, c]));

        const chargesToCreate: any[] = [];
        const chargeItemsToCreate: any[] = [];
        const paymentsToCreate: any[] = [];
        const allocationsToCreate: any[] = [];
        const advancesToCreate: any[] = [];

        for (const studentId of eligibleIds) {
          const studentOverrides = overridesByStudent.get(studentId) || [];
          const rawItems: { componentId: string; amount: number }[] = [];

          for (const item of classStructure.structure.items) {
            const comp = item.component;
            if (!comp.isActive) continue;
            if (!isDue(studentId, comp.id, comp.frequency)) continue;

            const override = studentOverrides.find(
              (o) => o.componentId === item.componentId,
            );
            if (override?.isExempt) continue;

            let amount =
              override?.amount !== null && override?.amount !== undefined
                ? Number(override.amount)
                : Number(item.amount ?? comp.amount);
            if (override?.discountAmount) {
              amount = Math.max(0, amount - Number(override.discountAmount));
            }
            amount = roundMoney(amount);
            if (amount > 0) rawItems.push({ componentId: comp.id, amount });
          }

          for (const override of studentOverrides) {
            const comp = extraCompMap.get(override.componentId);
            if (!comp || !comp.isActive || override.isExempt) continue;
            if (!override.amount || Number(override.amount) <= 0) continue;
            if (!isDue(studentId, comp.id, comp.frequency)) continue;

            let amount = Number(override.amount);
            if (override.discountAmount) {
              amount = Math.max(0, amount - Number(override.discountAmount));
            }
            amount = roundMoney(amount);
            if (amount > 0) rawItems.push({ componentId: comp.id, amount });
          }

          const transport = transportByStudent.get(studentId);
          if (
            transportComp &&
            transport &&
            Number(transport.monthlyFee) > 0 &&
            !rawItems.some((i) => i.componentId === transportComp.id)
          ) {
            rawItems.push({
              componentId: transportComp.id,
              amount: roundMoney(Number(transport.monthlyFee)),
            });
          }

          if (rawItems.length === 0) continue;

          // Advance balances: component-specific first, then general.
          let generalAdvance = 0;
          const componentAdvances: Record<string, number> = {};
          for (const l of ledgersByStudent.get(studentId) || []) {
            const amt = roundMoney(Number(l.amount));
            if (l.componentId) {
              componentAdvances[l.componentId] = roundMoney(
                (componentAdvances[l.componentId] || 0) + amt,
              );
            } else {
              generalAdvance = roundMoney(generalAdvance + amt);
            }
          }

          const chargeId = createCuid();
          const itemStatuses: FeeStatus[] = [];
          const deductions: {
            componentId?: string;
            amount: number;
            chargeItemId: string;
          }[] = [];

          for (const c of rawItems) {
            const chargeItemId = createCuid();
            let remaining = c.amount;
            let paid = 0;

            const compAdvance = componentAdvances[c.componentId] || 0;
            if (compAdvance > 0) {
              const use = roundMoney(Math.min(remaining, compAdvance));
              componentAdvances[c.componentId] = roundMoney(compAdvance - use);
              remaining = roundMoney(remaining - use);
              paid = roundMoney(paid + use);
              deductions.push({
                componentId: c.componentId,
                amount: use,
                chargeItemId,
              });
            }
            if (remaining > 0 && generalAdvance > 0) {
              const use = roundMoney(Math.min(remaining, generalAdvance));
              generalAdvance = roundMoney(generalAdvance - use);
              remaining = roundMoney(remaining - use);
              paid = roundMoney(paid + use);
              deductions.push({ amount: use, chargeItemId });
            }

            const status =
              paid >= c.amount
                ? FeeStatus.PAID
                : paid > 0
                  ? FeeStatus.PARTIAL
                  : FeeStatus.PENDING;
            itemStatuses.push(status);
            chargeItemsToCreate.push({
              id: chargeItemId,
              chargeId,
              componentId: c.componentId,
              amount: c.amount,
              paidAmount: paid,
              status,
            });
          }

          let chargeStatus: FeeStatus = FeeStatus.PENDING;
          if (itemStatuses.every((s) => s === FeeStatus.PAID))
            chargeStatus = FeeStatus.PAID;
          else if (
            itemStatuses.some(
              (s) => s === FeeStatus.PAID || s === FeeStatus.PARTIAL,
            )
          )
            chargeStatus = FeeStatus.PARTIAL;

          chargesToCreate.push({
            id: chargeId,
            schoolId,
            studentId,
            sessionId,
            title,
            periodKey,
            dueDate,
            status: chargeStatus,
          });

          if (deductions.length > 0) {
            // Moving a student's own advance onto this charge is not new
            // money: record it as an ADJUSTMENT so revenue reports don't
            // count the original payment twice. It gets no receipt number.
            const paymentId = createCuid();
            paymentsToCreate.push({
              id: paymentId,
              schoolId,
              studentId,
              amount: roundMoney(deductions.reduce((s, d) => s + d.amount, 0)),
              method: "OTHER",
              reference: `Advance settlement for ${title}`,
              receiptNo: `ADJ-${chargeId}`,
              remarks: `Auto-settled from student advance balance for ${title}`,
              status: ADJUSTMENT_STATUS,
            });
            for (const d of deductions) {
              allocationsToCreate.push({
                id: createCuid(),
                paymentId,
                chargeItemId: d.chargeItemId,
                amount: d.amount,
              });
              advancesToCreate.push({
                id: createCuid(),
                studentId,
                componentId: d.componentId || null,
                amount: -d.amount,
                description: `Auto-adjusted against generated fee: ${title}`,
              });
            }
          }

          generatedCount++;
        }

        if (chargesToCreate.length > 0) {
          await tx.feeCharge.createMany({ data: chargesToCreate });
          await tx.feeChargeItem.createMany({ data: chargeItemsToCreate });
        }
        if (paymentsToCreate.length > 0) {
          await tx.paymentTransaction.createMany({ data: paymentsToCreate });
        }
        if (allocationsToCreate.length > 0) {
          await tx.paymentAllocation.createMany({ data: allocationsToCreate });
        }
        if (advancesToCreate.length > 0) {
          await tx.advanceLedger.createMany({ data: advancesToCreate });
        }
      },
      { maxWait: 10000, timeout: 60000 },
    );

    return { success: true, generatedCount, alreadyGenerated };
  } catch (e: any) {
    // retryable: unlike the checks above, these can succeed on a second run;
    // the monthly cron leaves the school unbilled so it is tried again.
    if (e?.code === "P2002") {
      return {
        error: `Fees for ${formatPeriodLabel(periodKey)} were generated for some of these students at the same time by another run. Refresh and try again.`,
        retryable: true,
      };
    }
    return { error: e?.message || "Fee generation failed", retryable: true };
  }
}
