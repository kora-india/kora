/**
 * Cross-school (tenant) isolation.
 *
 * Two full schools share one database. Signed in to School B, every server
 * action and API route is called three ways:
 *
 *  - with School A's ids (the "cross" run),
 *  - with School B's ids but one of them swapped for School A's (a "mixed"
 *    run, e.g. B's student paying A's bill), once for each id it uses,
 *  - with School B's own ids (the "own" run), which must work. That proves
 *    the payload is valid, so the other runs were refused for the right
 *    reason and not because the input was wrong.
 *
 * After every call: none of School A's rows changed, nothing School B got
 * back (or any error) contains School A's data, and no School B row points
 * at a School A row. The checks walk Prisma's own description of the schema,
 * so a new table is covered without editing this file, and the coverage
 * tests fail when a new action, route or table has no case here.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Prisma, prisma } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { FULL_ACCESS, ROLE_DEFAULT_PERMISSIONS } from "@schoolos/types";

vi.mock("server-only", () => ({}));
// Cloudinary's network calls are faked; its signing code is the real one.
vi.mock("cloudinary", async (importOriginal) => {
  const real = await importOriginal<typeof import("cloudinary")>();
  real.v2.api.resource = (async () => ({
    format: "pdf",
    bytes: 1000,
    type: "private",
  })) as any;
  real.v2.uploader.destroy = (async () => ({ result: "ok" })) as any;
  return real;
});
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: (fn: (scope: unknown) => void) =>
    fn({ setTag: vi.fn(), setExtra: vi.fn() }),
}));

import {
  CANARY_AMOUNT,
  GLOBAL_MODELS,
  OWNERSHIP,
  crossLinks,
  idsOf,
  rowsContaining,
  removeSchool,
  seedSchool,
  snapshotDiff,
  snapshotSchool,
  type Tenant,
} from "./tenant/fixtures";

import * as account from "../actions/account";
import * as admissionSettings from "../actions/admission-settings";
import * as assignments from "../actions/assignments";
import * as attendanceImport from "../actions/attendance-import";
import * as attendance from "../actions/attendance";
import * as classes from "../actions/classes";
import * as exams from "../actions/exams";
import * as expenses from "../actions/expenses";
import * as employeeRecords from "../actions/employee-records";
import * as feeAllocator from "../actions/fee-allocator";
import * as feeGenerator from "../actions/fee-generator";
import * as feeHistory from "../actions/fee-history";
import * as feeImport from "../actions/fee-import";
import * as feeMigration from "../actions/fee-migration";
import * as feeSettings from "../actions/fee-settings";
import * as importMapping from "../actions/import-mapping";
import * as ledger from "../actions/ledger";
import * as notices from "../actions/notices";
import * as passwordReset from "../actions/password-reset";
import * as payroll from "../actions/payroll";
import * as plans from "../actions/plans";
import * as promotion from "../actions/promotion";
import * as schools from "../actions/schools";
import * as settings from "../actions/settings";
import * as staff from "../actions/staff";
import * as studentImport from "../actions/student-import";
import * as students from "../actions/students";
import * as superAdmin from "../actions/super-admin";
import * as teachers from "../actions/teachers";
import * as team from "../actions/team";
import * as timetable from "../actions/timetable";
import * as transport from "../actions/transport";

import * as attendanceRoute from "../../app/api/attendance/route";
import * as noticesRoute from "../../app/api/notices/route";
import * as studentsRoute from "../../app/api/students/route";
import * as starterDataRoute from "../../app/api/school/starter-data/route";
import * as schoolCreateRoute from "../../app/api/school/create/route";
import * as createOrderRoute from "../../app/api/payment/create-order/route";
import * as verifyRoute from "../../app/api/payment/verify/route";
import * as generateFeesRoute from "../../app/api/cron/generate-fees/route";
import * as lateFeesRoute from "../../app/api/cron/apply-late-fees/route";

const MODULES: Record<string, Record<string, unknown>> = {
  account,
  "admission-settings": admissionSettings,
  assignments,
  "attendance-import": attendanceImport,
  attendance,
  classes,
  exams,
  expenses,
  "employee-records": employeeRecords,
  "fee-allocator": feeAllocator,
  "fee-generator": feeGenerator,
  "fee-history": feeHistory,
  "fee-import": feeImport,
  "fee-migration": feeMigration,
  "fee-settings": feeSettings,
  "import-mapping": importMapping,
  ledger,
  notices,
  "password-reset": passwordReset,
  payroll,
  plans,
  promotion,
  schools,
  settings,
  staff,
  "student-import": studentImport,
  students,
  "super-admin": superAdmin,
  teachers,
  team,
  timetable,
  transport,
};

const run = Math.random().toString(36).slice(2, 8);
const CANARY = `Zqcanary${run}`;

type Role = "SCHOOL_ADMIN" | "TEACHER" | "ACCOUNTANT";

interface Case {
  /** Calls the action with the given school's ids. */
  call: (t: Tenant) => Promise<unknown>;
  /**
   * Whether School B's own run must succeed. A string says why it isn't
   * checked; the cross and mixed runs still are.
   */
  own?: true | string;
  /** Also attack as these School B logins (each given full access). */
  roles?: Role[];
  /** Only a super admin may call it: School B's admin must be refused. */
  superAdmin?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers for the cases
// ---------------------------------------------------------------------------

const today = "2026-11-20";

const historyRow = (admissionNumber: string, period: string) => ({
  sheetRow: 2,
  admissionNumber,
  period,
  fees: "1000",
  heads: {},
  lateFee: "",
  paid: "1000",
  paidOn: `05/${period.slice(5)}/${period.slice(0, 4)}`,
  mode: "Cash",
  receiptNo: "",
});

const attendanceRows = (t: Tenant) => [
  {
    period: "2026-07",
    sheetRow: 2,
    admissionNumber: t.admission,
    marks: { "1": "P", "2": "A" },
  },
];

const studentRow = (t: Tenant) => ({
  name: "New Pupil",
  classId: t.class,
  sectionId: t.section,
  parentName: "New Parent",
  parentPhone: "9444444444",
  gender: "FEMALE",
});

const routeInput = (t: Tenant, stopId?: string) => ({
  name: "Route North",
  vehicleId: t.vehicle,
  startPoint: "Depot",
  endPoint: "Gate",
  stops: [{ id: stopId, stopName: "First stop", sequenceOrder: 1 }],
});

const json = async (res: Response) => ({
  status: res.status,
  body: await res.json().catch(() => null),
});

const request = (url: string, body?: unknown, headers?: HeadersInit) =>
  new NextRequest(`http://localhost${url}`, {
    method: body === undefined ? "GET" : "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });

const RAZORPAY_SECRET = "tenant-test-secret";
const signature = (orderId: string, paymentId: string) =>
  crypto
    .createHmac("sha256", RAZORPAY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

// ---------------------------------------------------------------------------
// One case per server action (file.export) and API route (route:METHOD path).
// ---------------------------------------------------------------------------

const CASES: Record<string, Case> = {
  // account
  "account.changePassword": {
    call: () =>
      account.changePassword({
        currentPassword: "hash",
        newPassword: "new-password-1",
        confirmPassword: "new-password-1",
      }),
    own: "the fixture password isn't a real hash (change-password.test.ts covers it)",
  },
  "account.saveColorMode": { call: () => account.saveColorMode("dark") },

  // admission-settings
  "admission-settings.getAdmissionNumberSettings": {
    call: () => admissionSettings.getAdmissionNumberSettings(),
  },
  "admission-settings.saveAdmissionNumberSettings": {
    call: () =>
      admissionSettings.saveAdmissionNumberSettings({
        prefix: "ADM",
        format: "{PREFIX}-{SEQ:4}",
        nextSequence: 40,
      }),
  },
  "admission-settings.getNextAdmissionNumber": {
    call: () => admissionSettings.getNextAdmissionNumber(),
  },

  // assignments
  "assignments.createAssignment": {
    call: (t) =>
      assignments.createAssignment({
        title: "Essay",
        classId: t.class,
        sectionId: t.section,
        dueDate: "2026-12-10",
      }),
    roles: ["TEACHER"],
  },
  "assignments.updateAssignment": {
    call: (t) =>
      assignments.updateAssignment(t.assignment, {
        title: "Essay two",
        classId: t.class,
        sectionId: t.section,
        dueDate: "2026-12-11",
      }),
    roles: ["TEACHER"],
  },
  "assignments.deleteAssignment": {
    call: (t) => assignments.deleteAssignment(t.assignment),
    roles: ["TEACHER"],
  },

  // attendance-import
  "attendance-import.getAttendanceImportSetup": {
    call: () => attendanceImport.getAttendanceImportSetup(),
    roles: ["TEACHER"],
  },
  "attendance-import.getAttendanceTemplate": {
    call: (t) =>
      attendanceImport.getAttendanceTemplate({
        classId: t.class,
        sectionId: t.section,
        from: "2026-06",
        to: "2026-07",
      }),
    roles: ["TEACHER"],
  },
  "attendance-import.checkAttendanceImport": {
    call: (t) =>
      attendanceImport.checkAttendanceImport({
        classId: t.class,
        sectionId: t.section,
        rows: attendanceRows(t),
      }),
    roles: ["TEACHER"],
  },
  "attendance-import.importAttendance": {
    call: (t) =>
      attendanceImport.importAttendance({
        classId: t.class,
        sectionId: t.section,
        rows: attendanceRows(t),
        fileName: "july.xlsx",
      }),
    roles: ["TEACHER"],
  },
  "attendance-import.undoAttendanceImport": {
    call: (t) => attendanceImport.undoAttendanceImport(t.attendanceImport),
    roles: ["TEACHER"],
  },

  // attendance
  "attendance.markAttendance": {
    call: (t) =>
      attendance.markAttendance({
        classId: t.class,
        sectionId: t.section,
        date: today,
        records: [
          { studentId: t.student, status: "PRESENT" },
          { studentId: t.student2, status: "ABSENT" },
        ],
      }),
    roles: ["TEACHER"],
  },
  "attendance.getAttendanceForClass": {
    call: (t) =>
      attendance.getAttendanceForClass(t.class, t.section, "2026-11-02"),
    roles: ["TEACHER"],
  },

  // classes
  "classes.createClass": {
    call: (t) =>
      classes.createClass({
        name: "Class 7",
        grade: 7,
        classTeacherId: t.teacher,
        initialSections: ["A"],
      }),
  },
  "classes.updateClass": {
    call: (t) =>
      classes.updateClass(t.class, {
        name: "Class 5 renamed",
        grade: 5,
        classTeacherId: t.teacher,
      }),
  },
  "classes.deleteClass": { call: (t) => classes.deleteClass(t.spareClass) },
  "classes.createSection": {
    call: (t) => classes.createSection({ classId: t.class, name: "B" }),
  },
  "classes.createSections": {
    call: (t) =>
      classes.createSections({ classId: t.class, names: ["C", "D"] }),
  },
  "classes.deleteSection": {
    call: (t) => classes.deleteSection(t.spareSection),
  },

  // exams
  "exams.getExams": {
    call: () => exams.getExams("2026-27"),
    roles: ["TEACHER"],
  },
  "exams.getExamById": {
    call: (t) => exams.getExamById(t.exam),
    roles: ["TEACHER"],
  },
  "exams.createExam": {
    call: () =>
      exams.createExam({
        name: "Unit test",
        academicYear: "2026-27",
        startDate: "2026-12-01",
        endDate: "2026-12-05",
      }),
  },
  "exams.updateExam": {
    call: (t) => exams.updateExam(t.exam, { name: "Half yearly two" }),
  },
  "exams.deleteExam": { call: (t) => exams.deleteExam(t.exam) },
  "exams.togglePublishExam": { call: (t) => exams.togglePublishExam(t.exam) },
  "exams.addExamSubject": {
    call: (t) =>
      exams.addExamSubject({
        examId: t.exam,
        classId: t.class,
        subjectName: "Science",
      }),
  },
  "exams.deleteExamSubject": {
    call: (t) => exams.deleteExamSubject(t.examSubject),
  },
  "exams.getExamMarksSheet": {
    call: (t) => exams.getExamMarksSheet(t.examSubject, t.section),
    roles: ["TEACHER"],
  },
  "exams.saveBatchMarks": {
    call: (t) =>
      exams.saveBatchMarks(t.examSubject, [
        { studentId: t.student, marksObtained: 81 },
        { studentId: t.student2, marksObtained: 64 },
      ]),
    roles: ["TEACHER"],
  },
  "exams.getStudentReportCard": {
    call: (t) => exams.getStudentReportCard(t.exam, t.student),
    roles: ["TEACHER"],
  },
  "exams.getSectionReportCards": {
    call: (t) => exams.getSectionReportCards(t.exam, t.section),
    roles: ["TEACHER"],
  },

  // expenses
  // employee-records
  "employee-records.getEmployeeRecords": {
    call: (t) =>
      employeeRecords.getEmployeeRecords({ type: "teacher", id: t.teacher }),
  },
  "employee-records.getEmployeeRecords#staff": {
    call: (t) =>
      employeeRecords.getEmployeeRecords({ type: "staff", id: t.staff }),
  },
  "employee-records.saveEmployeeDetails": {
    call: (t) =>
      employeeRecords.saveEmployeeDetails(
        { type: "teacher", id: t.teacher },
        { panNumber: "CCCCC3333C", bankAccountNumber: "001234567890" },
      ),
  },
  "employee-records.saveEmployeeDetails#staff": {
    call: (t) =>
      employeeRecords.saveEmployeeDetails(
        { type: "staff", id: t.staff },
        { bankIfsc: "HDFC0001234" },
      ),
  },
  "employee-records.startDocumentUpload": {
    call: (t) =>
      employeeRecords.startDocumentUpload(
        { type: "staff", id: t.staff },
        {
          kind: "CERTIFICATE",
          fileName: "degree.pdf",
          size: 1000,
          type: "application/pdf",
        },
      ),
  },
  "employee-records.finishDocumentUpload": {
    call: (t) => employeeRecords.finishDocumentUpload(t.pendingDocument),
  },
  "employee-records.getDocumentLink": {
    call: (t) => employeeRecords.getDocumentLink(t.document),
  },
  "employee-records.deleteDocument": {
    call: (t) => employeeRecords.deleteDocument(t.document),
  },

  "expenses.createExpenseCategory": {
    call: () => expenses.createExpenseCategory({ name: "Sports" }),
  },
  "expenses.createExpense": {
    call: (t) =>
      expenses.createExpense({
        categoryId: t.expenseCategory,
        amount: 500,
        date: today,
        title: "Footballs",
        paymentMethod: "CASH",
      }),
  },
  "expenses.deleteExpense": { call: (t) => expenses.deleteExpense(t.expense) },

  // fee-allocator
  "fee-allocator.allocatePayment": {
    call: (t) =>
      feeAllocator.allocatePayment({
        studentId: t.student,
        monthPayments: [{ chargeId: t.charge, amount: 100 }],
        method: "CASH",
      }),
    roles: ["ACCOUNTANT"],
  },
  "fee-allocator.allocatePayment#items": {
    call: (t) =>
      feeAllocator.allocatePayment({
        studentId: t.student,
        itemPayments: [{ chargeItemId: t.lateItem, amount: 50 }],
        method: "UPI",
      }),
    roles: ["ACCOUNTANT"],
  },
  "fee-allocator.allocatePayment#components": {
    call: (t) =>
      feeAllocator.allocatePayment({
        studentId: t.student,
        componentPayments: [{ componentId: t.component, amount: 200 }],
        method: "CASH",
      }),
    roles: ["ACCOUNTANT"],
  },
  "fee-allocator.allocatePayment#advance": {
    call: (t) =>
      feeAllocator.allocatePayment({
        studentId: t.student2,
        generalAdvanceAmount: 300,
        method: "CASH",
      }),
    roles: ["ACCOUNTANT"],
  },
  "fee-allocator.getFeeReceiptDetails": {
    call: (t) => feeAllocator.getFeeReceiptDetails(t.receiptNo),
    roles: ["ACCOUNTANT"],
  },
  "fee-allocator.waiveFeeChargeItem": {
    call: (t) => feeAllocator.waiveFeeChargeItem(t.lateItem, "Forgiven once"),
  },
  "fee-allocator.getStudentFeeDues": {
    call: (t) => feeAllocator.getStudentFeeDues(t.student),
    roles: ["ACCOUNTANT"],
  },

  // fee-generator
  "fee-generator.generateMonthlyFees": {
    call: (t) =>
      feeGenerator.generateMonthlyFees(
        t.session,
        [t.class],
        "June 2026",
        "2026-06-10",
        "2026-06",
      ),
  },

  // fee-history
  "fee-history.getFeeHistorySetup": {
    call: () => feeHistory.getFeeHistorySetup(),
  },
  "fee-history.getFeeHistoryTemplate": {
    call: () =>
      feeHistory.getFeeHistoryTemplate({ from: "2026-04", to: "2026-05" }),
  },
  "fee-history.getStudentsHistoryTemplate": {
    call: () =>
      feeHistory.getStudentsHistoryTemplate({ from: "2026-04", to: "2026-05" }),
  },
  "fee-history.checkFeeHistory": {
    call: (t) =>
      feeHistory.checkFeeHistory({
        months: ["2026-07"],
        rows: [historyRow(t.admission2, "2026-07")],
      }),
  },
  "fee-history.startFeeHistoryImport": {
    call: () =>
      feeHistory.startFeeHistoryImport({ periods: ["2026-07"], heads: [] }),
  },
  "fee-history.importFeeHistoryBatch": {
    call: (t) =>
      feeHistory.importFeeHistoryBatch({
        importId: t.openHistoryImport,
        months: ["2026-07"],
        rows: [historyRow(t.admission2, "2026-07")],
      }),
  },
  "fee-history.finishFeeHistoryImport": {
    call: (t) => feeHistory.finishFeeHistoryImport(t.openHistoryImport),
  },

  // fee-import
  "fee-import.getOpeningBalanceSetup": {
    call: () => feeImport.getOpeningBalanceSetup(),
  },
  "fee-import.getOpeningBalanceTemplate": {
    call: () => feeImport.getOpeningBalanceTemplate(),
  },
  "fee-import.checkOpeningBalances": {
    call: (t) =>
      feeImport.checkOpeningBalances({
        asOfDate: "2026-04-01",
        rows: [
          {
            sheetRow: 2,
            admissionNumber: t.admission2,
            dues: "500",
            advance: "",
          },
        ],
      }),
  },
  "fee-import.importOpeningBalances": {
    call: (t) =>
      feeImport.importOpeningBalances({
        asOfDate: "2026-04-01",
        rows: [
          {
            sheetRow: 2,
            admissionNumber: t.admission2,
            dues: "500",
            advance: "",
          },
        ],
      }),
  },
  "fee-import.undoFeeImport": {
    call: (t) => feeImport.undoFeeImport(t.openingImport),
  },

  // fee-migration
  "fee-migration.runLegacyFeeMigration": {
    call: () => feeMigration.runLegacyFeeMigration(),
  },

  // fee-settings
  "fee-settings.createAcademicSession": {
    call: () =>
      feeSettings.createAcademicSession({
        name: "2027-28",
        startDate: "2027-04-01",
        endDate: "2028-03-31",
        isCurrent: false,
      }),
  },
  "fee-settings.createFeeComponent": {
    call: () =>
      feeSettings.createFeeComponent({
        name: "Sports",
        amount: 300,
        frequency: "MONTHLY" as any,
        isOptional: false,
      }),
  },
  "fee-settings.createFeeStructure": {
    call: (t) =>
      feeSettings.createFeeStructure({
        name: "Second plan",
        sessionId: t.session,
        components: [
          { componentId: t.component },
          { componentId: t.extraComponent },
        ],
      }),
  },
  "fee-settings.assignFeeStructureToClass": {
    call: (t) => feeSettings.assignFeeStructureToClass(t.class2, t.structure),
  },
  "fee-settings.setStudentFeeOverride": {
    call: (t) =>
      feeSettings.setStudentFeeOverride(t.student, t.session, t.component, {
        isExempt: false,
        discountAmount: 100,
      }),
  },
  "fee-settings.updateAcademicSession": {
    call: (t) =>
      feeSettings.updateAcademicSession(t.oldSession, {
        name: "2025-26 old",
        startDate: "2025-04-01",
        endDate: "2026-03-31",
        isCurrent: false,
      }),
  },
  "fee-settings.updateFeeComponent": {
    call: (t) =>
      feeSettings.updateFeeComponent(t.extraComponent, {
        name: "Library fee",
        amount: 200,
        frequency: "MONTHLY" as any,
        isOptional: true,
      }),
  },
  "fee-settings.updateFeeStructure": {
    call: (t) =>
      feeSettings.updateFeeStructure(t.structure, {
        name: "Standard two",
        sessionId: t.session,
        components: [
          { componentId: t.component },
          { componentId: t.extraComponent },
        ],
      }),
  },
  "fee-settings.saveLateFeeSettings": {
    call: () =>
      feeSettings.saveLateFeeSettings({
        lateFeeEnabled: true,
        lateFeeAmount: 20,
        lateFeeFrequency: "MONTHLY",
      }),
  },
  "fee-settings.saveFeeAutomationSettings": {
    call: () =>
      feeSettings.saveFeeAutomationSettings({ autoFeeGeneration: false }),
  },
  "fee-settings.saveFeeCollectionPolicy": {
    call: () =>
      feeSettings.saveFeeCollectionPolicy({ feePaymentMode: "FULL_ONLY" }),
  },
  "fee-settings.copyFeeStructures": {
    call: (t) =>
      feeSettings.copyFeeStructures({
        fromSessionId: t.oldSession,
        toSessionId: t.session,
      }),
  },

  // import-mapping
  "import-mapping.suggestImportMapping": {
    call: () =>
      importMapping.suggestImportMapping({
        columns: [{ header: "Pupil", description: "Asha, Ravi" }],
      }),
    own: "needs the Gemini API, which tests don't call",
  },

  // ledger
  "ledger.exportLedger": {
    call: (t) => ledger.exportLedger({ session: t.session, class: t.class }),
    roles: ["ACCOUNTANT"],
  },

  // notices
  "notices.createNotice": {
    call: (t) =>
      notices.createNotice({
        title: "Holiday",
        content: "School is closed tomorrow.",
        priority: "LOW",
        targetClassId: t.class,
      }),
  },
  "notices.updateNotice": {
    call: (t) =>
      notices.updateNotice(t.notice, {
        title: "Holiday moved",
        content: "School is closed on Friday.",
        priority: "HIGH",
        targetClassId: t.class,
      }),
  },
  "notices.deleteNotice": { call: (t) => notices.deleteNotice(t.notice) },
  "notices.toggleNoticePublish": {
    call: (t) => notices.toggleNoticePublish(t.notice, false),
  },

  // password-reset (public; see the dedicated tests below)
  "password-reset.requestPasswordReset": {
    call: () =>
      passwordReset.requestPasswordReset({
        email: "nobody-at-all@tenant.test",
      }),
  },
  "password-reset.resetPassword": {
    call: () =>
      passwordReset.resetPassword({
        token: "not-a-real-token",
        newPassword: "new-password-1",
        confirmPassword: "new-password-1",
      }),
    own: "needs a reset token; the dedicated test below covers it",
  },

  // payroll
  "payroll.generateSalarySlip": {
    call: (t) =>
      payroll.generateSalarySlip({
        teacherId: t.teacher,
        year: 2026,
        month: 11,
        basicSalary: 1000,
        allowances: 0,
        pfDeduction: 0,
        otherDeductions: 0,
      }),
  },
  "payroll.processPayout": {
    call: (t) => payroll.processPayout({ slipId: t.openSlip, method: "CASH" }),
  },
  "payroll.sendSalarySlip": { call: (t) => payroll.sendSalarySlip(t.slip) },

  // plans (super admin)
  "plans.updatePlan": {
    call: () =>
      plans.updatePlan("PRO", {
        name: "Pro",
        tagline: "Everything",
        monthlyPriceInr: 1,
        modules: [],
        benefits: [],
      }),
    superAdmin: true,
  },

  // promotion
  "promotion.getPromotionPlan": { call: () => promotion.getPromotionPlan() },
  "promotion.promoteStudents": {
    call: (t) =>
      promotion.promoteStudents({
        moves: [
          { fromClassId: t.class, to: { kind: "CLASS", classId: t.class2 } },
        ],
        exceptions: [{ studentId: t.student2, action: "REPEAT" }],
        renumber: false,
      }),
  },
  "promotion.undoPromotion": {
    call: (t) => promotion.undoPromotion(t.promotionBatch),
  },

  // schools (super admin)
  "schools.createSchool": {
    call: () =>
      schools.createSchool({
        name: "Sneaky School",
        subdomain: `sneaky-${run}`,
        adminName: "Sneaky",
        adminEmail: `sneaky-${run}@tenant.test`,
      }),
    superAdmin: true,
  },
  "schools.toggleSchoolStatus": {
    call: (t) => schools.toggleSchoolStatus(t.school),
    superAdmin: true,
  },
  "schools.updateSchoolPlan": {
    call: (t) => schools.updateSchoolPlan(t.school, "FREE"),
    superAdmin: true,
  },

  // settings
  "settings.updateSchoolProfile": {
    call: () => settings.updateSchoolProfile({ name: "Renamed School" }),
  },
  "settings.updateSchoolLogo": {
    call: () =>
      settings.updateSchoolLogo(
        "https://res.cloudinary.com/demo/image/upload/v1/kora_logos/logo.png",
      ),
  },
  "settings.updateSchoolThemeColor": {
    call: () => settings.updateSchoolThemeColor("purple"),
  },

  // staff
  "staff.createStaff": {
    call: () =>
      staff.createStaff({
        name: "New Peon",
        phone: "9333333333",
        occupation: "Peon",
      }),
  },
  "staff.updateStaff": {
    call: (t) =>
      staff.updateStaff(t.helper, {
        name: "Helper renamed",
        phone: "9000000001",
        occupation: "Peon",
      }),
  },
  "staff.deleteStaff": { call: (t) => staff.deleteStaff(t.helper) },
  "staff.getStaffList": { call: () => staff.getStaffList() },

  // student-import
  "student-import.bulkImportStudents": {
    call: (t) => studentImport.bulkImportStudents([studentRow(t)]),
  },
  "student-import.checkStudentsWithHistory": {
    call: (t) =>
      studentImport.checkStudentsWithHistory([
        {
          ...studentRow(t),
          admissionNumber: `NEW-${t.tag}-${run}`,
          sheetRow: 2,
        },
      ]),
  },
  "student-import.importStudentsWithHistory": {
    call: (t) =>
      studentImport.importStudentsWithHistory([
        {
          ...studentRow(t),
          admissionNumber: `NEW-${t.tag}-${run}`,
          sheetRow: 2,
        },
      ]),
  },

  // students
  "students.searchStudents": {
    call: () => students.searchStudents("Student"),
    roles: ["TEACHER", "ACCOUNTANT"],
  },
  "students.createStudent": {
    call: (t) =>
      students.createStudent({
        ...studentRow(t),
        rollNumber: "40",
        admissionNumber: `NEW-${t.tag}-${run}`,
      }),
  },
  "students.updateStudent": {
    call: (t) =>
      students.updateStudent(t.student2, {
        ...studentRow(t),
        name: "Renamed Pupil",
        rollNumber: "2",
        admissionNumber: t.admission2,
      }),
  },
  "students.deleteStudent": {
    call: (t) => students.deleteStudent(t.student2),
  },
  "students.deleteStudent#waive": {
    call: (t) => students.deleteStudent(t.student2, { waiveOpenCharges: true }),
  },
  "students.getStudentDetails": {
    call: (t) => students.getStudentDetails(t.student),
    roles: ["TEACHER", "ACCOUNTANT"],
  },

  // super-admin
  "super-admin.getSuperAdminSession": {
    call: () => superAdmin.getSuperAdminSession(),
    superAdmin: true,
  },
  "super-admin.getSuperAdminDashboardData": {
    call: () => superAdmin.getSuperAdminDashboardData(),
    superAdmin: true,
  },
  "super-admin.getSuperAdminAnalyticsData": {
    call: () => superAdmin.getSuperAdminAnalyticsData(),
    superAdmin: true,
  },

  // teachers
  "teachers.createTeacher": {
    call: (t) =>
      teachers.createTeacher({
        name: "New Teacher",
        email: `new-teacher-${t.tag}-${run}@tenant.test`,
        subject: "English",
        salary: "",
        assignedSectionIds: [t.section],
      }),
  },
  "teachers.updateTeacher": {
    call: (t) =>
      teachers.updateTeacher(t.teacher, {
        name: "Teacher renamed",
        email: t.teacherEmail,
        subject: "Maths",
        salary: 1000,
        assignedSectionIds: [t.section, t.section2],
      }),
  },
  "teachers.deleteTeacher": { call: (t) => teachers.deleteTeacher(t.teacher) },

  // team
  "team.updateMemberPermissions": {
    call: (t) =>
      team.updateMemberPermissions(
        t.accountantUser,
        ROLE_DEFAULT_PERMISSIONS.TEACHER,
      ),
  },
  "team.resetMemberPermissions": {
    call: (t) => team.resetMemberPermissions(t.accountantUser),
  },

  // timetable
  "timetable.getTimetablePeriods": {
    call: () => timetable.getTimetablePeriods(),
    roles: ["TEACHER"],
  },
  "timetable.savePeriodSettings": {
    call: (t) =>
      timetable.savePeriodSettings([
        {
          id: t.period,
          name: "First",
          periodNumber: 1,
          startTime: "08:00",
          endTime: "08:40",
          isBreak: false,
        },
      ]),
  },
  "timetable.getTimetable": {
    call: (t) =>
      timetable.getTimetable({ classId: t.class, sectionId: t.section }),
    roles: ["TEACHER"],
  },
  "timetable.checkSlotConflict": {
    call: (t) =>
      timetable.checkSlotConflict({
        classId: t.class,
        sectionId: t.section,
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "08:40",
        teacherId: t.teacher,
      }),
  },
  "timetable.saveTimetableSlot": {
    call: (t) =>
      timetable.saveTimetableSlot({
        id: t.slot,
        classId: t.class,
        sectionId: t.section,
        dayOfWeek: 2,
        startTime: "08:00",
        endTime: "08:40",
        subjectName: "Science",
        teacherId: t.teacher,
        periodId: t.period,
      }),
  },
  "timetable.saveTimetableSlot#new": {
    call: (t) =>
      timetable.saveTimetableSlot({
        classId: t.class2,
        sectionId: t.section2,
        dayOfWeek: 3,
        startTime: "08:00",
        endTime: "08:40",
        subjectName: "Art",
        teacherId: t.teacher,
        periodId: t.period,
      }),
  },
  "timetable.deleteTimetableSlot": {
    call: (t) => timetable.deleteTimetableSlot(t.slot),
  },
  "timetable.clearSectionTimetable": {
    call: (t) => timetable.clearSectionTimetable(t.section),
  },
  "timetable.generateAutomatedTimetableAction": {
    call: (t) =>
      timetable.generateAutomatedTimetableAction({
        classId: t.class,
        sectionId: t.section,
        subjects: [
          { subjectName: "Maths", periodsPerWeek: 2, teacherId: t.teacher },
        ],
        replaceExisting: true,
      }),
  },
  "timetable.generateAiTimetableAction": {
    call: (t) =>
      timetable.generateAiTimetableAction({
        classId: t.class,
        sectionId: t.section,
        subjects: [
          { subjectName: "Maths", periodsPerWeek: 2, teacherId: t.teacher },
        ],
        replaceExisting: true,
      }),
    own: "needs the Gemini API, which tests don't call",
  },
  "timetable.auditSchoolConflicts": {
    call: () => timetable.auditSchoolConflicts(),
  },

  // transport
  "transport.getTransportData": { call: () => transport.getTransportData() },
  "transport.createVehicle": {
    call: () =>
      transport.createVehicle({
        registrationNo: `DL-NEW-${run}`,
        capacity: 20,
        driverName: "Ram",
        driverPhone: "9555555555",
      } as any),
  },
  "transport.updateVehicle": {
    call: (t) =>
      transport.updateVehicle(t.vehicle, {
        registrationNo: `DL-UPD-${run}`,
        capacity: 25,
        driverName: "Shyam",
        driverPhone: "9555555556",
      }),
  },
  "transport.deleteVehicle": {
    call: (t) => transport.deleteVehicle(t.spareVehicle),
  },
  "transport.createRoute": {
    call: (t) => transport.createRoute(routeInput(t) as any),
  },
  "transport.updateRoute": {
    call: (t) => transport.updateRoute(t.route, routeInput(t, t.stop) as any),
  },
  "transport.deleteRoute": { call: (t) => transport.deleteRoute(t.spareRoute) },
  "transport.enrollStudentTransport": {
    call: (t) =>
      transport.enrollStudentTransport({
        studentId: t.student2,
        routeId: t.route,
        stopId: t.stop,
        vehicleId: t.vehicle,
        distanceKm: 2,
        monthlyFee: 500,
      } as any),
  },
  "transport.cancelStudentTransport": {
    call: (t) => transport.cancelStudentTransport(t.enrollment),
  },
  "transport.getRoutePassengerManifest": {
    call: (t) => transport.getRoutePassengerManifest(t.route),
  },

  // API routes
  "route:POST /api/attendance": {
    call: async (t) =>
      json(
        await attendanceRoute.POST(
          request("/api/attendance", {
            classId: t.class,
            sectionId: t.section,
            date: today,
            records: [{ studentId: t.student, status: "PRESENT" }],
          }),
        ),
      ),
    roles: ["TEACHER"],
  },
  "route:GET /api/attendance": {
    call: async (t) =>
      json(
        await attendanceRoute.GET(
          request(
            `/api/attendance?classId=${t.class}&sectionId=${t.section}&date=2026-11-02`,
          ),
        ),
      ),
    roles: ["TEACHER"],
  },
  "route:POST /api/notices": {
    call: async (t) =>
      json(
        await noticesRoute.POST(
          request("/api/notices", {
            title: "Sports day",
            content: "Sports day is on Monday.",
            priority: "LOW",
            targetClassId: t.class,
          }),
        ),
      ),
  },
  "route:GET /api/students": {
    call: async (t) =>
      json(
        await studentsRoute.GET(
          request(`/api/students?classId=${t.class}&sectionId=${t.section}`),
        ),
      ),
    roles: ["TEACHER"],
  },
  "route:POST /api/school/starter-data": {
    call: async () =>
      json(
        await starterDataRoute.POST(request("/api/school/starter-data", {})),
      ),
    own: "only for a school without a session; this one has one",
  },
  "route:POST /api/school/create": {
    call: async () =>
      json(
        await schoolCreateRoute.POST(
          request("/api/school/create", {
            name: "Second School",
            subdomain: `second-${run}`,
          }),
        ),
      ),
    own: "only for a login that has no school yet",
  },
  "route:POST /api/payment/create-order": {
    call: async () =>
      json(
        await createOrderRoute.POST(
          request("/api/payment/create-order", {
            plan: "PRO",
            purpose: "RENEWAL",
          }),
        ),
      ),
    own: "needs Razorpay",
  },
  "route:POST /api/payment/verify": {
    call: async (t) =>
      json(
        await verifyRoute.POST(
          request("/api/payment/verify", {
            razorpay_order_id: t.order,
            razorpay_payment_id: `pay_${t.tag}_${run}`,
            razorpay_signature: signature(t.order, `pay_${t.tag}_${run}`),
          }),
        ),
      ),
  },
};

/** Routes and actions with no case, and why none is needed. */
const NOT_CASES: Record<string, string> = {
  "route:GET /api/health": "reads no school data",
  "route:POST /api/upload":
    "stores a file in Cloudinary; reads and writes no rows",
  "route:POST /api/school/check-subdomain":
    "public; answers only whether a subdomain is free",
  "route:POST /api/auth/register": "public sign-up; no school exists yet",
  "route:POST /api/auth/send-otp": "public sign-up code; no school exists yet",
  "route:GET /api/auth/[...nextauth]": "NextAuth's own handler",
  "route:POST /api/auth/[...nextauth]": "NextAuth's own handler",
  "route:GET /api/cron/generate-fees":
    "runs for every school by design; see the cron test below",
  "route:GET /api/cron/apply-late-fees":
    "runs for every school by design; see the cron test below",
};

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

let A: Tenant;
let B: Tenant;
let baselineA: Record<string, any[]>;
let idsA: Set<string>;

const ROLE_USER: Record<Role, string> = {
  SCHOOL_ADMIN: "admin",
  TEACHER: "teacherUser",
  ACCOUNTANT: "accountantUser",
};

async function signInToB(role: Role) {
  const id = B[ROLE_USER[role]];
  // Admin-granted extra access, so each role reaches as far as it can.
  if (role !== "SCHOOL_ADMIN") {
    await prisma.user.update({
      where: { id },
      data: { permissions: FULL_ACCESS as any },
    });
  }
  vi.mocked(auth).mockResolvedValue({
    user: { id, schoolId: B.school, role, name: "Attacker" },
  } as any);
}

async function freshB() {
  if (B) await removeSchool(B.school);
  B = await seedSchool("B", run, CANARY);
}

interface Outcome {
  value?: unknown;
  thrown?: string;
}

async function attempt(fn: () => Promise<unknown>): Promise<Outcome> {
  try {
    return { value: await fn() };
  } catch (err) {
    // Next's redirect()/notFound() throw too; their digest is the message.
    const e = err as { message?: string; digest?: string };
    return { thrown: `${e?.message ?? ""} ${e?.digest ?? ""}`.trim() };
  }
}

/** Whether a result is a refusal rather than a success. */
function refused({ value, thrown }: Outcome) {
  if (thrown !== undefined) return true;
  if (value === null || value === undefined) return true;
  if (typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if ("error" in v && v.error) return true;
  if (v.success === false) return true;
  if (typeof v.status === "number" && v.status >= 400) return true;
  return false;
}

function describeOutcome({ value, thrown }: Outcome) {
  return thrown !== undefined
    ? `threw: ${thrown}`
    : JSON.stringify(value)?.slice(0, 600);
}

/** School A data in what came back, ignoring ids the caller sent in. */
function leaks(outcome: Outcome, sentIds: Set<string>) {
  const text =
    outcome.thrown ??
    JSON.stringify(outcome.value, (_k, v) =>
      typeof v === "bigint" ? String(v) : v,
    ) ??
    "";
  const found: string[] = [];
  if (text.includes(CANARY)) found.push("School A's text");
  if (new RegExp(`(^|[^0-9])${CANARY_AMOUNT}([^0-9]|$)`).test(text)) {
    found.push(`School A's amount ${CANARY_AMOUNT}`);
  }
  for (const id of idsA) {
    if (!sentIds.has(id) && text.includes(id)) found.push(`School A id ${id}`);
  }
  return found;
}

/** A tenant that records which of its keys a case read. */
function recording(t: Tenant, used: Set<string>) {
  return new Proxy(t, {
    get(target, key: string) {
      if (key in target) used.add(key);
      return target[key];
    },
  });
}

async function checkSchoolA(label: string) {
  const now = await snapshotSchool(A.school);
  const diff = snapshotDiff(baselineA, now);
  expect(diff, `${label}: School A changed`).toEqual([]);
}

async function checkNoLinksIntoA(label: string) {
  const snapshotB = await snapshotSchool(B.school);
  const links = crossLinks(snapshotB, idsA);
  expect(links, `${label}: School B now points at School A`).toEqual([]);
  const copied = rowsContaining(snapshotB, CANARY);
  expect(copied, `${label}: School A's data was copied into School B`).toEqual(
    [],
  );
}

async function attack(name: string, c: Case, role: Role) {
  await freshB();
  await signInToB(role);

  // Cross: every id is School A's.
  const used = new Set<string>();
  const cross = await attempt(() => c.call(recording(A, used)));
  const sent = new Set([...used].map((k) => A[k]));
  const label = `${name} as ${role} with School A's ids`;
  expect(leaks(cross, sent), `${label}: ${describeOutcome(cross)}`).toEqual([]);
  if (c.superAdmin) {
    expect(
      refused(cross),
      `${label} wasn't refused: ${describeOutcome(cross)}`,
    ).toBe(true);
  }
  await checkSchoolA(label);
  await checkNoLinksIntoA(label);

  // Mixed: School B's ids with one of them swapped for School A's.
  const keys = [...used].filter((k) => k !== "tag" && A[k] !== B[k]);
  if (keys.length > 1) {
    for (const key of keys) {
      const mixed = { ...B, [key]: A[key] };
      const out = await attempt(() => c.call(mixed));
      const mixedLabel = `${name} as ${role} with School A's ${key}`;
      expect(
        leaks(out, new Set([A[key]])),
        `${mixedLabel}: ${describeOutcome(out)}`,
      ).toEqual([]);
      await checkSchoolA(mixedLabel);
      await checkNoLinksIntoA(mixedLabel);
    }
  }

  // Own: School B's ids, which must work for the admin.
  if (role !== "SCHOOL_ADMIN" || c.superAdmin) return;
  await freshB();
  await signInToB(role);
  const own = await attempt(() => c.call(B));
  const ownLabel = `${name} with School B's own ids`;
  expect(leaks(own, new Set()), `${ownLabel}: ${describeOutcome(own)}`).toEqual(
    [],
  );
  if (c.own === undefined || c.own === true) {
    expect(refused(own), `${ownLabel} failed: ${describeOutcome(own)}`).toBe(
      false,
    );
  }
  await checkSchoolA(ownLabel);
  await checkNoLinksIntoA(ownLabel);
}

describe("cross-school isolation", () => {
  beforeAll(async () => {
    process.env.RAZORPAY_KEY_SECRET = RAZORPAY_SECRET;
    process.env.CRON_SECRET = "tenant-cron-secret";
    process.env.CLOUDINARY_CLOUD_NAME = "tenant-cloud";
    process.env.CLOUDINARY_API_KEY = "tenant-key";
    process.env.CLOUDINARY_API_SECRET = "tenant-cloud-secret";
    process.env.DATA_ENCRYPTION_KEY = "tenant-isolation-data-key-32-chars-long";
    A = await seedSchool("A", run, CANARY);
    baselineA = await snapshotSchool(A.school);
    idsA = idsOf(baselineA, A.school);
  }, 120_000);

  afterAll(async () => {
    vi.mocked(auth).mockReset();
    for (const t of [A, B]) if (t) await removeSchool(t.school);
  }, 120_000);

  describe("the fixture", () => {
    it("gives every school table at least one row in School A", () => {
      const empty = Object.keys(OWNERSHIP).filter(
        (m) => OWNERSHIP[m] && !baselineA[m]?.length,
      );
      expect(empty).toEqual([]);
    });

    it("knows which school owns every table", () => {
      const unknown = Object.keys(OWNERSHIP).filter(
        (m) => !OWNERSHIP[m] && !GLOBAL_MODELS[m],
      );
      expect(unknown).toEqual([]);
    });

    it("keeps the two schools apart to begin with", async () => {
      await freshB();
      await checkNoLinksIntoA("fixture");
      expect(
        crossLinks(baselineA, idsOf(await snapshotSchool(B.school), B.school)),
      ).toEqual([]);
    });
  });

  describe("coverage", () => {
    it("has a case for every exported server action", () => {
      const missing: string[] = [];
      for (const [file, mod] of Object.entries(MODULES)) {
        for (const [name, value] of Object.entries(mod)) {
          if (typeof value !== "function") continue;
          if (!CASES[`${file}.${name}`]) missing.push(`${file}.${name}`);
        }
      }
      expect(missing).toEqual([]);
    });

    it("imports every action file", () => {
      const dir = path.resolve(__dirname, "../actions");
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".ts"))
        .map((f) => f.replace(/\.ts$/, ""));
      expect(files.filter((f) => !MODULES[f])).toEqual([]);
    });

    it("has a case (or a reason) for every API route", () => {
      const root = path.resolve(__dirname, "../../app/api");
      const routes: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.name === "route.ts") {
            const source = fs.readFileSync(full, "utf8");
            const url = `/api/${path.relative(root, dir)}`;
            for (const m of source.matchAll(
              /export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b|export\s*\{\s*handlers\s+as\s+(GET)/g,
            )) {
              routes.push(`route:${m[1] ?? m[2]} ${url}`);
            }
            if (
              /export const \{\s*GET,\s*POST\s*\}|handlers as GET, handlers as POST|export const { GET, POST }/.test(
                source,
              )
            ) {
              routes.push(`route:GET ${url}`, `route:POST ${url}`);
            }
          }
        }
      };
      walk(root);
      const missing = [...new Set(routes)].filter(
        (r) => !CASES[r] && !NOT_CASES[r],
      );
      expect(missing).toEqual([]);
      // And no stale entries for routes that are gone.
      const stale = [...Object.keys(NOT_CASES), ...Object.keys(CASES)]
        .filter((r) => r.startsWith("route:"))
        .filter((r) => !routes.includes(r));
      expect(stale).toEqual([]);
    });
  });

  describe("signed in to School B", () => {
    for (const [name, c] of Object.entries(CASES)) {
      const roles: Role[] = ["SCHOOL_ADMIN", ...(c.roles ?? [])];
      for (const role of roles) {
        it(`${name} as ${role}`, () => attack(name, c, role), 120_000);
      }
    }
  });

  describe("public password reset", () => {
    it("answers the same for another school's email as for no account", async () => {
      await freshB();
      const known = await passwordReset.requestPasswordReset({
        email: A.adminEmail,
      });
      const unknown = await passwordReset.requestPasswordReset({
        email: `nobody-${run}@tenant.test`,
      });
      expect(known).toEqual(unknown);
      expect(leaks({ value: known }, new Set())).toEqual([]);
    });

    it("a reset token changes only its own login", async () => {
      await freshB();
      const token = `tenant-token-${run}`;
      await prisma.user.update({
        where: { id: B.admin },
        data: {
          resetToken: crypto.createHash("sha256").update(token).digest("hex"),
          resetTokenExpiry: new Date(Date.now() + 3600_000),
        },
      });
      // Whatever the token's storage format, School A must not change.
      const before = await snapshotSchool(A.school);
      await attempt(() =>
        passwordReset.resetPassword({
          token,
          newPassword: "brand-new-pass-1",
          confirmPassword: "brand-new-pass-1",
        }),
      );
      expect(snapshotDiff(before, await snapshotSchool(A.school))).toEqual([]);
    });
  });

  describe("cron jobs that run for every school", () => {
    const cron = (url: string) =>
      request(url, undefined, { authorization: "Bearer tenant-cron-secret" });

    it("generate each school's bills from its own fee setup", async () => {
      await freshB();
      await attempt(() =>
        generateFeesRoute.GET(cron("/api/cron/generate-fees")),
      );
      await checkNoLinksIntoA("cron generate-fees");
      const afterA = await snapshotSchool(A.school);
      expect(
        crossLinks(afterA, idsOf(await snapshotSchool(B.school), B.school)),
      ).toEqual([]);
    });

    it("add each school's late fees to its own bills", async () => {
      await freshB();
      await attempt(() => lateFeesRoute.GET(cron("/api/cron/apply-late-fees")));
      await checkNoLinksIntoA("cron apply-late-fees");
      const afterA = await snapshotSchool(A.school);
      expect(
        crossLinks(afterA, idsOf(await snapshotSchool(B.school), B.school)),
      ).toEqual([]);
    });
  });
});
