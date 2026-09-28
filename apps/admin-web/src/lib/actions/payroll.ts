"use server";

import { randomBytes } from "crypto";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import type { Prisma } from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatCurrency } from "@schoolos/utils";
import { sendMail } from "@/lib/mailer";
import {
  EDITABLE_STATUSES,
  MAX_AMOUNT,
  PAYABLE_STATUSES,
  STATUS_META,
  computeSalary,
  formatPayrollMonth,
  methodLabel,
  serializeSlip,
  type SalarySlipStatus,
} from "@/lib/payroll";

async function getAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

const money = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} can't be negative`)
    .max(MAX_AMOUNT, `${label} is too large`)
    .refine(
      (n) => Math.round(n * 100) === n * 100,
      `${label} can have at most 2 decimal places`,
    );

const GenerateSchema = z.object({
  teacherId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  basicSalary: money("Basic salary").refine(
    (n) => n > 0,
    "Basic salary is required",
  ),
  allowances: money("Allowances"),
  pfDeduction: money("PF"),
  otherDeductions: money("Other deduction"),
});

const PayoutSchema = z.object({
  slipId: z.string().min(1),
  method: z.enum(["BANK_TRANSFER", "UPI", "CASH"]),
  reference: z
    .string()
    .trim()
    .max(100, "Reference must be at most 100 characters")
    .optional()
    .nullable(),
});

function revalidateTeacher(teacherId: string) {
  revalidatePath(`/teachers/${teacherId}`);
  revalidatePath("/teachers");
}

function isMissingTable(e: any) {
  return e?.code === "P2021" || e?.code === "P2022";
}

const SETUP_ERROR =
  "Payroll isn't set up in the database yet. Apply the payroll schema (prisma db push) and try again.";

export async function generateSalarySlip(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = GenerateSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const { teacherId, year, month, ...amounts } = parsed.data;

  const now = new Date();
  if (year * 12 + month > now.getFullYear() * 12 + now.getMonth() + 1) {
    return { error: "You can't generate a salary slip for a future month" };
  }

  const totals = computeSalary(amounts);
  if (totals.netSalary < 0) {
    return { error: "Deductions can't be more than the gross salary" };
  }

  try {
    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, schoolId: user.schoolId },
      select: { id: true, isActive: true },
    });
    if (!teacher) return { error: "Teacher not found" };
    if (!teacher.isActive)
      return { error: "Salary slips can't be generated for inactive teachers" };

    const existing = await prisma.salarySlip.findUnique({
      where: { teacherId_year_month: { teacherId, year, month } },
    });

    const values = {
      ...amounts,
      ...totals,
      status: "GENERATED" as const,
      generatedById: user.id,
    };

    if (existing) {
      if (!EDITABLE_STATUSES.includes(existing.status as SalarySlipStatus)) {
        const label = STATUS_META[existing.status as SalarySlipStatus].label;
        return {
          error: `The ${formatPayrollMonth(year, month)} salary slip is already ${label.toLowerCase()} and can't be changed`,
        };
      }
      const updated = await prisma.salarySlip.update({
        where: { id: existing.id },
        data: values,
        include: { payouts: true },
      });
      revalidateTeacher(teacherId);
      return { success: true, updated: true, slip: serializeSlip(updated) };
    }

    // Slip numbers are sequential per school and month: SAL-2026-09-002.
    for (let attempt = 0; attempt < 3; attempt++) {
      const count = await prisma.salarySlip.count({
        where: { schoolId: user.schoolId, year, month },
      });
      const slipNumber = `SAL-${year}-${String(month).padStart(2, "0")}-${String(
        count + 1 + attempt,
      ).padStart(3, "0")}`;
      try {
        const created = await prisma.salarySlip.create({
          data: {
            ...values,
            slipNumber,
            year,
            month,
            teacherId,
            schoolId: user.schoolId,
          },
          include: { payouts: true },
        });
        revalidateTeacher(teacherId);
        return { success: true, updated: false, slip: serializeSlip(created) };
      } catch (e: any) {
        const target = String(e?.meta?.target ?? "");
        if (e?.code === "P2002" && target.includes("slipNumber")) continue;
        if (e?.code === "P2002")
          return {
            error: `A salary slip for ${formatPayrollMonth(year, month)} already exists`,
          };
        throw e;
      }
    }
    return { error: "Couldn't allocate a slip number. Please try again." };
  } catch (e: any) {
    if (isMissingTable(e)) return { error: SETUP_ERROR };
    return { error: e.message || "Failed to generate salary slip" };
  }
}

function newTransactionId(date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `PAY-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Records a salary payout. Kora doesn't move money itself, so this records a
 * payment made by bank transfer, UPI or cash. The slip is claimed with a
 * conditional update inside the transaction, so two concurrent submissions
 * can't both succeed, and it only becomes PAID once the payout is saved.
 */
export async function processPayout(data: unknown) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  const parsed = PayoutSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const { slipId, method, reference } = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const claimed = await tx.salarySlip.updateMany({
          where: {
            id: slipId,
            schoolId: user.schoolId,
            status: { in: PAYABLE_STATUSES },
          },
          data: { status: "PROCESSING" },
        });

        if (claimed.count === 0) {
          const slip = await tx.salarySlip.findFirst({
            where: { id: slipId, schoolId: user.schoolId },
            select: { status: true },
          });
          if (!slip) return { error: "Salary slip not found" };
          if (slip.status === "PAID")
            return { error: "This salary has already been paid" };
          if (slip.status === "PROCESSING")
            return {
              error: "A payout for this salary is already being processed",
            };
          return {
            error: "Generate the salary slip before processing a payout",
          };
        }

        const slip = await tx.salarySlip.findUniqueOrThrow({
          where: { id: slipId },
          select: { netSalary: true, teacherId: true },
        });

        const payout = await tx.payrollPayout.create({
          data: {
            schoolId: user.schoolId,
            salarySlipId: slipId,
            amount: slip.netSalary,
            method,
            reference: reference || null,
            status: "SUCCEEDED",
            transactionId: newTransactionId(),
            processedAt: new Date(),
            processedById: user.id,
          },
        });

        const paid = await tx.salarySlip.update({
          where: { id: slipId },
          data: { status: "PAID" },
          include: { payouts: true },
        });

        return {
          success: true as const,
          payoutId: payout.id,
          slip: paid,
          teacherId: slip.teacherId,
        };
      },
    );

    if ("error" in result) return { error: result.error };
    revalidateTeacher(result.teacherId);
    const slip = serializeSlip(result.slip);
    return {
      success: true,
      slip,
      payout: slip.payouts.find((p) => p.id === result.payoutId)!,
    };
  } catch (e: any) {
    if (isMissingTable(e)) return { error: SETUP_ERROR };
    return { error: e.message || "Failed to process payout" };
  }
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export async function sendSalarySlip(slipId: string) {
  const user = await getAdminSession();
  if (!user) return { error: "Unauthorized" };

  try {
    const slip = await prisma.salarySlip.findFirst({
      where: { id: slipId, schoolId: user.schoolId },
      include: {
        teacher: { select: { name: true, email: true } },
        school: { select: { name: true } },
        payouts: { where: { status: "SUCCEEDED" }, take: 1 },
      },
    });
    if (!slip) return { error: "Salary slip not found" };
    if (!slip.teacher.email)
      return { error: "This teacher has no email address" };

    const period = formatPayrollMonth(slip.year, slip.month);
    const row = (label: string, value: unknown, bold = false) =>
      `<tr><td style="padding:6px 0;color:#555">${esc(label)}</td><td style="padding:6px 0;text-align:right;${bold ? "font-weight:700" : ""}">${esc(formatCurrency(Number(value)))}</td></tr>`;
    const payout = slip.payouts[0];

    const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">
  <h2 style="margin:0 0 4px">${esc(slip.school.name)}</h2>
  <p style="margin:0 0 16px;color:#666">Salary slip ${esc(slip.slipNumber)} · ${esc(period)}</p>
  <p>Dear ${esc(slip.teacher.name)},</p>
  <p>Your salary slip for ${esc(period)} is below.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td colspan="2" style="padding-top:12px;font-weight:700">Earnings</td></tr>
    ${row("Basic Salary", slip.basicSalary)}
    ${row("Allowances", slip.allowances)}
    ${row("Gross Salary", slip.grossSalary, true)}
    <tr><td colspan="2" style="padding-top:12px;font-weight:700">Deductions</td></tr>
    ${row("PF", slip.pfDeduction)}
    ${row("Other Deductions", slip.otherDeductions)}
    ${row("Total Deductions", slip.totalDeductions, true)}
    <tr><td colspan="2"><hr style="border:none;border-top:1px solid #ddd"/></td></tr>
    ${row("Net Salary", slip.netSalary, true)}
  </table>
  <p style="color:#666;font-size:13px">Payment status: ${
    payout
      ? `Paid via ${esc(methodLabel(payout.method))} (Transaction ${esc(payout.transactionId)})`
      : "Not yet paid"
  }</p>
</div>`;

    const sent = await sendMail({
      to: slip.teacher.email,
      subject: `Salary slip for ${period} — ${slip.school.name}`,
      html,
    });
    if (!sent.success) {
      return {
        error: `Couldn't send email: ${sent.error ?? "mail server error"}`,
      };
    }

    await prisma.salarySlip.update({
      where: { id: slip.id },
      data: { sentAt: new Date() },
    });
    revalidateTeacher(slip.teacherId);
    return { success: true, to: slip.teacher.email };
  } catch (e: any) {
    if (isMissingTable(e)) return { error: SETUP_ERROR };
    return { error: e.message || "Failed to send salary slip" };
  }
}
