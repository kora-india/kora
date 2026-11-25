/**
 * Two complete schools for the cross-school (tenant) isolation suite.
 *
 * Every table that holds school data gets at least one row in each school,
 * so an action that reaches into the wrong school has something to find.
 * School A's text carries a canary word and its money a canary amount; if
 * either shows up in what School B gets back, School A's data leaked.
 */
import { Prisma, prisma, purgeSchool } from "@schoolos/db";

/** Ids (and a few plain values) of one seeded school, by role. */
export type Tenant = Record<string, string>;

/** Only School A's rows contain these; B's never do. */
export const CANARY_AMOUNT = 7331;

const month = (d: string) => new Date(`${d}T00:00:00.000Z`);

export async function seedSchool(
  tag: "A" | "B",
  run: string,
  canary: string,
): Promise<Tenant> {
  // Only A's names carry the canary. Values an attacker types in (admission
  // numbers, receipt numbers, emails) never do, so an error message that
  // echoes the attacker's own input isn't mistaken for a leak.
  const label = (text: string) =>
    tag === "A" ? `${text} ${canary}` : `${text} Other`;
  const amount = tag === "A" ? CANARY_AMOUNT : 1000;
  const lower = tag.toLowerCase();
  const id = `tenant-${lower}-${run}`;
  const t: Tenant = { school: id, tag };

  await prisma.school.create({
    data: {
      id,
      name: label("School"),
      subdomain: id,
      plan: "PRO",
      address: label("Road"),
      lateFeeEnabled: true,
      lateFeeAmount: 50,
      subscription: { create: { plan: "PRO", status: "ACTIVE" } },
    },
  });

  const user = (role: "SCHOOL_ADMIN" | "TEACHER" | "ACCOUNTANT", who: string) =>
    prisma.user.create({
      data: {
        email: `${who}-${lower}-${run}@tenant.test`,
        name: label(who),
        password: "hash",
        role,
        schoolId: id,
      },
    });
  const admin = await user("SCHOOL_ADMIN", "admin");
  const teacherUser = await user("TEACHER", "teacher");
  const accountantUser = await user("ACCOUNTANT", "accountant");
  Object.assign(t, {
    admin: admin.id,
    adminEmail: admin.email,
    teacherUser: teacherUser.id,
    teacherEmail: teacherUser.email,
    accountantUser: accountantUser.id,
  });

  const session = await prisma.academicSession.create({
    data: {
      schoolId: id,
      name: "2026-27",
      startDate: month("2026-04-01"),
      endDate: month("2027-03-31"),
      isCurrent: true,
    },
  });
  // A past session, for actions that copy from one session to another.
  const oldSession = await prisma.academicSession.create({
    data: {
      schoolId: id,
      name: "2025-26",
      startDate: month("2025-04-01"),
      endDate: month("2026-03-31"),
      isCurrent: false,
    },
  });
  t.session = session.id;
  t.oldSession = oldSession.id;

  const klass = await prisma.class.create({
    data: { schoolId: id, name: label("Class 5"), grade: 5 },
  });
  const klass2 = await prisma.class.create({
    data: { schoolId: id, name: label("Class 6"), grade: 6 },
  });
  const section = await prisma.section.create({
    data: { schoolId: id, classId: klass.id, name: "A" },
  });
  const section2 = await prisma.section.create({
    data: { schoolId: id, classId: klass2.id, name: "A" },
  });
  // An extra section with nobody in it, safe to delete.
  const spareSection = await prisma.section.create({
    data: { schoolId: id, classId: klass.id, name: "Z" },
  });
  // A class with nothing in it, safe to delete.
  const spareClass = await prisma.class.create({
    data: { schoolId: id, name: label("Class 9"), grade: 9 },
  });
  Object.assign(t, {
    class: klass.id,
    class2: klass2.id,
    section: section.id,
    section2: section2.id,
    spareSection: spareSection.id,
    spareClass: spareClass.id,
  });

  const teacher = await prisma.teacher.create({
    data: {
      schoolId: id,
      userId: teacherUser.id,
      name: label("Teacher"),
      email: teacherUser.email,
      subject: "Maths",
      salary: amount,
    },
  });
  await prisma.teacherSection.create({
    data: {
      schoolId: id,
      teacherId: teacher.id,
      classId: klass.id,
      sectionId: section.id,
    },
  });
  await prisma.class.update({
    where: { id: klass.id },
    data: { classTeacherId: teacher.id },
  });
  t.teacher = teacher.id;

  const staff = await prisma.staff.create({
    data: {
      schoolId: id,
      name: label("Accountant"),
      phone: "9000000000",
      occupation: "Accountant",
      userId: accountantUser.id,
      salary: amount,
    },
  });
  const helper = await prisma.staff.create({
    data: {
      schoolId: id,
      name: label("Helper"),
      phone: "9000000001",
      occupation: "Peon",
    },
  });
  t.staff = staff.id;
  t.helper = helper.id;

  // ID and bank details, and documents (one kept, one still uploading).
  await prisma.employeeDetails.create({
    data: {
      schoolId: id,
      teacherId: teacher.id,
      panNumber: tag === "A" ? "AAAAA1111A" : "BBBBB2222B",
      aadhaarEncrypted: `v1.d.fixture.${tag}.only`,
      aadhaarLast4: tag === "A" ? "1111" : "2222",
      bankAccountHolder: label("Account holder"),
      bankName: label("Bank"),
      bankAccountLast4: "4321",
      bankIfsc: "SBIN0001234",
    },
  });
  await prisma.employeeDetails.create({
    data: { schoolId: id, staffId: staff.id, bankName: label("Staff bank") },
  });
  const document = (status: string, n: number) =>
    prisma.employeeDocument.create({
      data: {
        schoolId: id,
        teacherId: teacher.id,
        kind: "MARKSHEET",
        title: label(`Marksheet ${n}`),
        fileName: `marks-${n}.pdf`,
        format: "pdf",
        bytes: 1000,
        publicId: `kora_documents/${id}/doc-${n}`,
        status,
        uploadedById: admin.id,
        uploadedByName: label("admin"),
      },
    });
  t.document = (await document("READY", 1)).id;
  t.pendingDocument = (await document("PENDING", 2)).id;
  await prisma.employeeDocument.create({
    data: {
      schoolId: id,
      staffId: staff.id,
      kind: "AADHAAR",
      fileName: "aadhaar.jpg",
      format: "jpg",
      bytes: 500,
      publicId: `kora_documents/${id}/doc-3`,
      status: "READY",
      uploadedByName: label("admin"),
    },
  });

  const student = (n: number, sectionRow = section, classRow = klass) =>
    prisma.student.create({
      data: {
        schoolId: id,
        classId: classRow.id,
        sectionId: sectionRow.id,
        rollNumber: String(n),
        admissionNumber: `ADM-${tag}${n}-${run}`,
        name: label(`Student ${n}`),
        parentName: label(`Parent ${n}`),
        parentPhone: "9111111111",
        address: label("Street"),
      },
    });
  const s1 = await student(1);
  const s2 = await student(2);
  const s3 = await student(3, section2, klass2);
  Object.assign(t, {
    student: s1.id,
    student2: s2.id,
    student3: s3.id,
    admission: s1.admissionNumber,
    admission2: s2.admissionNumber,
  });

  const component = await prisma.feeComponent.create({
    data: {
      schoolId: id,
      name: label("Tuition"),
      amount,
      frequency: "MONTHLY",
    },
  });
  const extra = await prisma.feeComponent.create({
    data: {
      schoolId: id,
      name: label("Library"),
      amount,
      frequency: "MONTHLY",
      isOptional: true,
    },
  });
  const late = await prisma.feeComponent.create({
    data: {
      schoolId: id,
      name: label("Late Fee"),
      amount: 0,
      frequency: "MONTHLY",
      category: "LATE_FEE",
    },
  });
  t.component = component.id;
  t.extraComponent = extra.id;
  t.lateComponent = late.id;

  const structure = await prisma.feeStructure.create({
    data: {
      schoolId: id,
      name: label("Standard"),
      sessionId: session.id,
      items: { create: [{ componentId: component.id }] },
    },
  });
  const oldStructure = await prisma.feeStructure.create({
    data: {
      schoolId: id,
      name: label("Standard old"),
      sessionId: oldSession.id,
      items: { create: [{ componentId: component.id }] },
    },
  });
  t.structure = structure.id;
  t.oldStructure = oldStructure.id;
  await prisma.classFeeStructure.create({
    data: { classId: klass.id, structureId: structure.id },
  });
  await prisma.studentFeeAssignment.create({
    data: {
      studentId: s1.id,
      sessionId: session.id,
      structureId: structure.id,
    },
  });
  await prisma.studentFeeOverride.create({
    data: {
      studentId: s1.id,
      sessionId: session.id,
      componentId: extra.id,
      isExempt: true,
      remarks: label("Exempt"),
    },
  });

  // An unpaid April bill with a late fee, and a paid May bill.
  const unpaid = await prisma.feeCharge.create({
    data: {
      schoolId: id,
      studentId: s1.id,
      sessionId: session.id,
      title: label("April 2026"),
      periodKey: "2026-04",
      dueDate: month("2026-04-10"),
      status: "OVERDUE",
      items: {
        create: [
          { componentId: component.id, amount, status: "PENDING" },
          { componentId: late.id, amount: 50, status: "PENDING" },
        ],
      },
    },
    include: { items: true },
  });
  const paid = await prisma.feeCharge.create({
    data: {
      schoolId: id,
      studentId: s1.id,
      sessionId: session.id,
      title: label("May 2026"),
      periodKey: "2026-05",
      dueDate: month("2026-05-10"),
      status: "PAID",
      items: {
        create: [
          {
            componentId: component.id,
            amount,
            paidAmount: amount,
            status: "PAID",
          },
        ],
      },
    },
    include: { items: true },
  });
  t.charge = unpaid.id;
  t.chargeItem = unpaid.items.find((i) => i.componentId === component.id)!.id;
  t.lateItem = unpaid.items.find((i) => i.componentId === late.id)!.id;
  t.paidCharge = paid.id;
  t.paidItem = paid.items[0].id;
  // A second unpaid bill for the other student, for waivers and deletes.
  const other = await prisma.feeCharge.create({
    data: {
      schoolId: id,
      studentId: s2.id,
      sessionId: session.id,
      title: label("April 2026"),
      periodKey: "2026-04",
      dueDate: month("2026-04-10"),
      status: "PENDING",
      items: { create: [{ componentId: component.id, amount }] },
    },
    include: { items: true },
  });
  t.charge2 = other.id;
  t.chargeItem2 = other.items[0].id;

  const receiptNo = `R${tag}-${run}-0001`;
  const payment = await prisma.paymentTransaction.create({
    data: {
      schoolId: id,
      studentId: s1.id,
      amount,
      receiptNo,
      remarks: label("Paid at desk"),
      collectedById: admin.id,
      receiptSnapshot: { studentName: label("Student 1") },
      allocations: {
        create: [{ chargeItemId: paid.items[0].id, amount }],
      },
    },
  });
  t.payment = payment.id;
  t.receiptNo = receiptNo;
  t.advance = (
    await prisma.advanceLedger.create({
      data: {
        studentId: s1.id,
        componentId: component.id,
        amount,
        description: label("Advance"),
      },
    })
  ).id;

  const fee = await prisma.fee.create({
    data: {
      schoolId: id,
      studentId: s2.id,
      classId: klass.id,
      feeType: label("Old tuition"),
      amount,
      dueDate: month("2026-04-10"),
      status: "PARTIAL",
      paidAmount: 100,
    },
  });
  t.legacyFee = fee.id;
  t.legacyPayment = (
    await prisma.payment.create({
      data: {
        schoolId: id,
        feeId: fee.id,
        amount: 100,
        receiptNo: `L${tag}-${run}-0001`,
      },
    })
  ).id;

  t.notice = (
    await prisma.notice.create({
      data: {
        schoolId: id,
        title: label("Notice"),
        content: label("Notice body text"),
        targetClassId: klass.id,
        publishedById: admin.id,
      },
    })
  ).id;
  t.assignment = (
    await prisma.assignment.create({
      data: {
        schoolId: id,
        classId: klass.id,
        sectionId: section.id,
        teacherId: teacher.id,
        title: label("Homework"),
        description: label("Homework details"),
        dueDate: month("2026-12-01"),
      },
    })
  ).id;

  const category = await prisma.expenseCategory.create({
    data: { schoolId: id, name: label("Stationery") },
  });
  t.expenseCategory = category.id;
  t.expense = (
    await prisma.expense.create({
      data: {
        schoolId: id,
        categoryId: category.id,
        amount,
        title: label("Chalk"),
        paymentMethod: "CASH",
        recordedById: admin.id,
      },
    })
  ).id;

  const vehicle = await prisma.vehicle.create({
    data: {
      schoolId: id,
      registrationNo: `DL-${tag}-${run}`,
      capacity: 30,
      driverName: label("Driver"),
      driverPhone: "9222222222",
    },
  });
  const route = await prisma.transportRoute.create({
    data: {
      schoolId: id,
      name: label("Route"),
      vehicleId: vehicle.id,
      startPoint: label("Depot"),
      endPoint: label("School gate"),
      stops: {
        create: [{ stopName: label("Stop"), sequenceOrder: 1 }],
      },
    },
    include: { stops: true },
  });
  // A route nobody rides, safe to delete.
  const spareRoute = await prisma.transportRoute.create({
    data: {
      schoolId: id,
      name: label("Spare route"),
      startPoint: label("Depot"),
      endPoint: label("School gate"),
      stops: { create: [{ stopName: label("Spare stop"), sequenceOrder: 1 }] },
    },
  });
  const spareVehicle = await prisma.vehicle.create({
    data: {
      schoolId: id,
      registrationNo: `DL-${tag}-${run}-2`,
      capacity: 10,
      driverName: label("Driver 2"),
      driverPhone: "9222222223",
    },
  });
  Object.assign(t, {
    vehicle: vehicle.id,
    spareVehicle: spareVehicle.id,
    route: route.id,
    spareRoute: spareRoute.id,
    stop: route.stops[0].id,
  });
  t.enrollment = (
    await prisma.studentTransport.create({
      data: {
        schoolId: id,
        studentId: s1.id,
        sessionId: session.id,
        routeId: route.id,
        stopId: route.stops[0].id,
        vehicleId: vehicle.id,
        distanceKm: 3,
        monthlyFee: amount,
        notes: label("Transport"),
      },
    })
  ).id;

  const exam = await prisma.exam.create({
    data: {
      schoolId: id,
      name: label("Half yearly"),
      academicYear: "2026-27",
      startDate: month("2026-09-01"),
      endDate: month("2026-09-10"),
      isPublished: true,
    },
  });
  const examSubject = await prisma.examSubject.create({
    data: { examId: exam.id, classId: klass.id, subjectName: label("Maths") },
  });
  t.exam = exam.id;
  t.examSubject = examSubject.id;
  t.mark = (
    await prisma.examMark.create({
      data: {
        examSubjectId: examSubject.id,
        studentId: s1.id,
        marksObtained: 73,
        remarks: label("Good"),
      },
    })
  ).id;

  const period = await prisma.timetablePeriod.create({
    data: {
      schoolId: id,
      name: label("Period 1"),
      periodNumber: 1,
      startTime: "08:00",
      endTime: "08:40",
    },
  });
  t.period = period.id;
  t.slot = (
    await prisma.timetableSlot.create({
      data: {
        schoolId: id,
        classId: klass.id,
        sectionId: section.id,
        teacherId: teacher.id,
        periodId: period.id,
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "08:40",
        subjectName: label("Maths"),
        room: label("Room"),
      },
    })
  ).id;

  const slip = await prisma.salarySlip.create({
    data: {
      schoolId: id,
      teacherId: teacher.id,
      slipNumber: `SAL-${tag}-${run}`,
      month: 10,
      year: 2026,
      basicSalary: amount,
      grossSalary: amount,
      totalDeductions: 0,
      netSalary: amount,
      generatedById: admin.id,
    },
  });
  t.slip = slip.id;
  t.payout = (
    await prisma.payrollPayout.create({
      data: {
        schoolId: id,
        salarySlipId: slip.id,
        amount,
        method: "UPI",
        transactionId: `TXN-${tag}-${run}`,
        status: "FAILED",
        failureReason: label("Bank down"),
      },
    })
  ).id;
  // An unpaid slip, so a payout can be made in the school's own run.
  t.openSlip = (
    await prisma.salarySlip.create({
      data: {
        schoolId: id,
        teacherId: teacher.id,
        slipNumber: `SAL-${tag}-${run}-2`,
        month: 9,
        year: 2026,
        basicSalary: amount,
        grossSalary: amount,
        totalDeductions: 0,
        netSalary: amount,
      },
    })
  ).id;

  const batchId = `batch-${lower}-${run}`;
  await prisma.studentPromotion.create({
    data: {
      schoolId: id,
      batchId,
      studentId: s3.id,
      action: "PROMOTED",
      fromClassId: klass.id,
      fromSectionId: section.id,
      fromRollNumber: "3",
      toClassId: klass2.id,
      toSectionId: section2.id,
      toRollNumber: "3",
      cancelledTransportIds: [],
      sessionId: session.id,
      createdById: admin.id,
    },
  });
  t.promotionBatch = batchId;

  await prisma.activityLog.create({
    data: {
      schoolId: id,
      actorId: admin.id,
      actorName: label("admin"),
      actorRole: "SCHOOL_ADMIN",
      action: "CREATE",
      module: "students",
      summary: label("Added a student"),
      entityType: "Student",
      entityId: s1.id,
    },
  });

  // An opening balance import: a bill and an advance it brought in.
  const opening = await prisma.feeImport.create({
    data: {
      schoolId: id,
      sessionId: session.id,
      asOfDate: month("2026-04-01"),
      fileName: label("opening.xlsx"),
      studentCount: 1,
      totalDues: amount,
      totalAdvance: 0,
      chargedComponentIds: [component.id],
      createdById: admin.id,
      createdByName: label("admin"),
      students: { create: [{ studentId: s3.id }] },
    },
  });
  t.openingImport = opening.id;
  await prisma.feeCharge.create({
    data: {
      schoolId: id,
      studentId: s3.id,
      sessionId: session.id,
      title: label("Opening balance"),
      periodKey: "OPENING",
      dueDate: month("2026-04-01"),
      importId: opening.id,
      items: { create: [{ componentId: component.id, amount }] },
    },
  });

  // A finished fee history import.
  const history = await prisma.feeImport.create({
    data: {
      schoolId: id,
      kind: "FULL_HISTORY",
      sessionId: session.id,
      asOfDate: month("2026-06-30"),
      fileName: label("history.xlsx"),
      studentCount: 1,
      totalDues: 0,
      totalAdvance: 0,
      chargedComponentIds: [],
      createdByName: label("admin"),
    },
  });
  t.historyImport = history.id;
  // One still being imported, which batches can be added to.
  t.openHistoryImport = (
    await prisma.feeImport.create({
      data: {
        schoolId: id,
        kind: "FULL_HISTORY",
        status: "IMPORTING",
        sessionId: session.id,
        asOfDate: month("2026-11-01"),
        fileName: label("history2.xlsx"),
        studentCount: 0,
        totalDues: 0,
        totalAdvance: 0,
        chargedComponentIds: [],
        createdById: admin.id,
        createdByName: label("admin"),
      },
    })
  ).id;

  // An attendance import, and one day of attendance from it.
  const attendanceImport = await prisma.attendanceImport.create({
    data: {
      schoolId: id,
      classId: klass.id,
      sectionId: section.id,
      className: label("Class 5"),
      sectionName: "A",
      fromMonth: "2026-06",
      toMonth: "2026-06",
      fileName: label("attendance.xlsx"),
      studentCount: 1,
      dayCount: 1,
      recordCount: 1,
      createdById: admin.id,
      createdByName: label("admin"),
    },
  });
  t.attendanceImport = attendanceImport.id;
  await prisma.attendance.create({
    data: {
      schoolId: id,
      studentId: s1.id,
      classId: klass.id,
      sectionId: section.id,
      date: month("2026-06-01"),
      status: "ABSENT",
      markedById: admin.id,
      importId: attendanceImport.id,
    },
  });
  await prisma.attendance.create({
    data: {
      schoolId: id,
      studentId: s1.id,
      classId: klass.id,
      sectionId: section.id,
      date: month("2026-11-02"),
      status: "PRESENT",
      markedById: teacherUser.id,
      remarks: label("On time"),
    },
  });

  await prisma.subscriptionOrder.create({
    data: {
      orderId: `order-${lower}-${run}`,
      userId: admin.id,
      plan: "PRO",
      amount: amount * 100,
      schoolId: id,
      purpose: "RENEWAL",
    },
  });
  t.order = `order-${lower}-${run}`;

  return t;
}

export async function removeSchool(schoolId: string) {
  // Deleting the school only unlinks its logins, so note them first.
  const users = await prisma.user.findMany({
    where: { schoolId },
    select: { id: true },
  });
  await prisma.subscriptionOrder.deleteMany({ where: { schoolId } });
  await prisma.activityLog.deleteMany({ where: { schoolId } });
  await purgeSchool(prisma, schoolId);
  await prisma.user.deleteMany({
    where: { id: { in: users.map((u) => u.id) } },
  });
}

// ---------------------------------------------------------------------------
// Which school a row belongs to, worked out from the schema itself, so a new
// table is covered (or flagged by the coverage test) without editing this.
// ---------------------------------------------------------------------------

type Model = (typeof Prisma.dmmf.datamodel.models)[number];
const models = Prisma.dmmf.datamodel.models;

/** Tables shared by every school, which no school owns. */
export const GLOBAL_MODELS: Record<string, string> = {
  PlanLimit: "plan limits are the same for every school",
  PlanConfig: "the plan catalogue is the same for every school",
  Otp: "sign-up codes are keyed by email before any school exists",
};

type Where = (schoolId: string) => Record<string, unknown>;

function ownerPath(model: Model, seen = new Set<string>()): Where | null {
  if (model.name === "School") return (schoolId) => ({ id: schoolId });
  if (model.fields.some((f) => f.name === "schoolId" && f.kind === "scalar")) {
    return (schoolId) => ({ schoolId });
  }
  seen.add(model.name);
  // Through a required parent first: those rows can't exist without it.
  const parents = model.fields
    .filter((f) => f.kind === "object" && f.relationFromFields?.length)
    .sort((a, b) => Number(b.isRequired) - Number(a.isRequired));
  for (const field of parents) {
    if (seen.has(field.type)) continue;
    const parent = models.find((m) => m.name === field.type)!;
    const inner = ownerPath(parent, new Set(seen));
    if (!inner) continue;
    return field.isRequired
      ? (schoolId) => ({ [field.name]: inner(schoolId) })
      : (schoolId) => ({ [field.name]: { is: inner(schoolId) } });
  }
  return null;
}

export const OWNERSHIP: Record<string, Where | null> = Object.fromEntries(
  models.map((m) => [m.name, GLOBAL_MODELS[m.name] ? null : ownerPath(m)]),
);

const delegate = (name: string) =>
  (prisma as any)[name[0].toLowerCase() + name.slice(1)];

const idField = (m: Model) => m.fields.find((f) => f.isId)?.name ?? "id";

/** Every row a school owns, table by table, in a fixed order. */
export async function snapshotSchool(schoolId: string) {
  const out: Record<string, unknown[]> = {};
  for (const m of models) {
    const where = OWNERSHIP[m.name];
    if (!where) continue;
    out[m.name] = await delegate(m.name).findMany({
      where: where(schoolId),
      orderBy: { [idField(m)]: "asc" },
    });
  }
  return JSON.parse(JSON.stringify(out)) as Record<string, any[]>;
}

/** Every id in a snapshot (row ids, and the school's own id). */
export function idsOf(snapshot: Record<string, any[]>, schoolId: string) {
  const ids = new Set<string>([schoolId]);
  for (const [name, rows] of Object.entries(snapshot)) {
    const m = models.find((x) => x.name === name)!;
    const key = idField(m);
    for (const row of rows) if (typeof row[key] === "string") ids.add(row[key]);
  }
  return ids;
}

/**
 * Fields that only record what someone typed, not a link to a row: the
 * activity log keeps a request's filters as they were sent.
 */
const FREE_TEXT_FIELDS = new Set(["ActivityLog.details"]);

/** Columns that hold ids: foreign keys, `...Id(s)` columns, and JSON. */
function referenceFields(m: Model) {
  const foreignKeys = new Set(
    m.fields.flatMap((f) =>
      f.kind === "object" ? (f.relationFromFields ?? []) : [],
    ),
  );
  return m.fields
    .filter((f) => f.kind === "scalar" && !f.isId)
    .filter(
      (f) =>
        foreignKeys.has(f.name) || /Ids?$/.test(f.name) || f.type === "Json",
    )
    .map((f) => f.name)
    .filter((name) => !FREE_TEXT_FIELDS.has(`${m.name}.${name}`));
}

/**
 * Rows of one school that point at another school's rows: a foreign key, an
 * id kept in a plain column or an array, or one inside JSON.
 */
export function crossLinks(
  snapshot: Record<string, any[]>,
  foreignIds: Set<string>,
) {
  const found: string[] = [];
  for (const [name, rows] of Object.entries(snapshot)) {
    const m = models.find((x) => x.name === name)!;
    const key = idField(m);
    const fields = referenceFields(m);
    for (const row of rows) {
      for (const field of fields) {
        const text = JSON.stringify(row[field] ?? null);
        for (const id of foreignIds) {
          if (text.includes(`"${id}"`)) {
            found.push(`${name} ${row[key]}.${field} -> ${id}`);
          }
        }
      }
    }
  }
  return found;
}

/** Rows whose text contains a word (another school's canary). */
export function rowsContaining(snapshot: Record<string, any[]>, word: string) {
  const found: string[] = [];
  for (const [name, rows] of Object.entries(snapshot)) {
    const key = idField(models.find((x) => x.name === name)!);
    for (const row of rows) {
      if (JSON.stringify(row).includes(word)) found.push(`${name} ${row[key]}`);
    }
  }
  return found;
}

/** Field-by-field differences between two snapshots, for failure messages. */
export function snapshotDiff(
  before: Record<string, any[]>,
  after: Record<string, any[]>,
) {
  const diffs: string[] = [];
  for (const name of Object.keys(before)) {
    const m = models.find((x) => x.name === name)!;
    const key = idField(m);
    const was = new Map(before[name].map((r) => [r[key], r]));
    const now = new Map((after[name] ?? []).map((r) => [r[key], r]));
    for (const [id, row] of was) {
      const next = now.get(id);
      if (!next) {
        diffs.push(`${name} ${id} deleted`);
        continue;
      }
      for (const field of Object.keys(row)) {
        if (JSON.stringify(row[field]) !== JSON.stringify(next[field])) {
          diffs.push(
            `${name} ${id}.${field}: ${JSON.stringify(row[field])} -> ${JSON.stringify(next[field])}`,
          );
        }
      }
    }
    for (const id of now.keys()) {
      if (!was.has(id)) diffs.push(`${name} ${id} added`);
    }
  }
  return diffs;
}
