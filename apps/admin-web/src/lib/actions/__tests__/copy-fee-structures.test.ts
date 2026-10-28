import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
// Next.js resolves "server-only" at build time; vitest can't.
vi.mock("server-only", () => ({}));
import { prisma, purgeSchool } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { copyFeeStructures } from "../fee-settings";
import { generateMonthlyFees } from "../fee-generator";

const schoolId = `copyfees-${Math.random().toString(36).slice(2, 8)}`;

const signInAs = (id: string, role: string) =>
  vi.mocked(auth).mockResolvedValue({
    user: { id, schoolId, role, name: role },
  } as any);

describe("copying last year's fees to a new session", () => {
  let adminId: string;
  let teacherId: string;
  const session: Record<string, string> = {};
  const grade: Record<4 | 5, string> = { 4: "", 5: "" };
  let tuition: string;
  let annual: string;
  let pupil: string;
  let leaver: string;

  /** A session's structures as { name: { fee head: amount or "default" } }. */
  const structuresIn = async (name: string) => {
    const list = await prisma.feeStructure.findMany({
      where: { schoolId, sessionId: session[name] },
      include: {
        items: { include: { component: true } },
        classAssignments: { include: { class: true } },
      },
      orderBy: { name: "asc" },
    });
    return Object.fromEntries(
      list.map((s) => [
        s.name,
        {
          classes: s.classAssignments.map((a) => a.class.name).sort(),
          items: Object.fromEntries(
            s.items.map((i) => [
              i.component.name,
              i.amount === null ? "default" : Number(i.amount),
            ]),
          ),
        },
      ]),
    );
  };

  beforeAll(async () => {
    await prisma.school.create({
      data: {
        id: schoolId,
        name: "Copy School",
        subdomain: schoolId,
        plan: "ENTERPRISE",
      },
    });
    const user = (role: "SCHOOL_ADMIN" | "TEACHER") =>
      prisma.user.create({
        data: {
          email: `${role}-${schoolId}@t.test`,
          name: role,
          password: "x",
          role,
          schoolId,
        },
      });
    adminId = (await user("SCHOOL_ADMIN")).id;
    teacherId = (await user("TEACHER")).id;

    for (const [name, start, end, isCurrent] of [
      ["2025-26", "2025-04-01", "2026-03-31", false],
      ["2026-27", "2026-04-01", "2027-03-31", true],
      ["2027-28", "2027-04-01", "2028-03-31", false],
    ] as const) {
      session[name] = (
        await prisma.academicSession.create({
          data: {
            schoolId,
            name,
            startDate: new Date(start),
            endDate: new Date(end),
            isCurrent,
          },
        })
      ).id;
    }
    for (const g of [4, 5] as const) {
      const c = await prisma.class.create({
        data: { schoolId, name: `Grade ${g}`, grade: g },
      });
      grade[g] = c.id;
      await prisma.section.create({
        data: { schoolId, classId: c.id, name: "A" },
      });
    }
    tuition = (
      await prisma.feeComponent.create({
        data: {
          schoolId,
          name: "Tuition Fee",
          amount: 2000,
          frequency: "MONTHLY",
        },
      })
    ).id;
    annual = (
      await prisma.feeComponent.create({
        data: {
          schoolId,
          name: "Annual Charges",
          amount: 3000,
          frequency: "YEARLY",
        },
      })
    ).id;

    // Last year: one structure per grade, and a retired one.
    for (const [name, g, tuitionAmount, status] of [
      ["Grade 4 fees", 4, 2100, "ACTIVE"],
      ["Grade 5 fees", 5, 2500, "ACTIVE"],
      ["Old plan", null, 1000, "INACTIVE"],
    ] as const) {
      const s = await prisma.feeStructure.create({
        data: {
          schoolId,
          sessionId: session["2025-26"],
          name,
          status,
          items: {
            create: [
              { componentId: tuition, amount: tuitionAmount },
              { componentId: annual }, // follows the fee head's 3,000
            ],
          },
        },
      });
      if (g) {
        await prisma.classFeeStructure.create({
          data: { classId: grade[g], structureId: s.id },
        });
      }
    }

    const sectionId = (
      await prisma.section.findFirstOrThrow({ where: { classId: grade[4] } })
    ).id;
    const student = (name: string, isActive: boolean) =>
      prisma.student.create({
        data: {
          schoolId,
          name,
          classId: grade[4],
          sectionId,
          rollNumber: name,
          admissionNumber: `ADM-${name}`,
          parentName: "Parent",
          parentPhone: "9999999999",
          isActive,
        },
      });
    pupil = (await student("Asha", true)).id;
    leaver = (await student("Left", false)).id;
    for (const studentId of [pupil, leaver]) {
      await prisma.studentFeeOverride.create({
        data: {
          studentId,
          sessionId: session["2025-26"],
          componentId: tuition,
          discountAmount: 300,
          remarks: "Sibling",
        },
      });
    }
  });

  afterAll(async () => {
    await purgeSchool(prisma, schoolId);
  });

  it("copies the active structures, their classes and current students' concessions", async () => {
    signInAs(adminId, "SCHOOL_ADMIN");
    const res = await copyFeeStructures({
      fromSessionId: session["2025-26"],
      toSessionId: session["2026-27"],
      includeConcessions: true,
    });
    expect(res).toEqual({
      success: true,
      copied: ["Grade 4 fees", "Grade 5 fees"],
      skippedStructures: [],
      classesAssigned: 2,
      skippedClasses: [],
      concessions: 1,
    });
    expect(await structuresIn("2026-27")).toEqual({
      "Grade 4 fees": {
        classes: ["Grade 4"],
        items: { "Tuition Fee": 2100, "Annual Charges": "default" },
      },
      "Grade 5 fees": {
        classes: ["Grade 5"],
        items: { "Tuition Fee": 2500, "Annual Charges": "default" },
      },
    });
    const concessions = await prisma.studentFeeOverride.findMany({
      where: { sessionId: session["2026-27"] },
    });
    expect(
      concessions.map((c) => [
        c.studentId,
        Number(c.discountAmount),
        c.remarks,
      ]),
    ).toEqual([[pupil, 300, "Sibling"]]);
  });

  it("copies nothing twice", async () => {
    signInAs(adminId, "SCHOOL_ADMIN");
    const res = await copyFeeStructures({
      fromSessionId: session["2025-26"],
      toSessionId: session["2026-27"],
      includeConcessions: true,
    });
    expect(res).toMatchObject({
      copied: [],
      skippedStructures: ["Grade 4 fees", "Grade 5 fees"],
      concessions: 0,
    });
    expect(Object.keys(await structuresIn("2026-27"))).toHaveLength(2);
  });

  it("raises fees by a percentage, rounded, and leaves a class's own structure alone", async () => {
    signInAs(adminId, "SCHOOL_ADMIN");
    // Grade 4 already has a structure next year.
    const own = await prisma.feeStructure.create({
      data: {
        schoolId,
        sessionId: session["2027-28"],
        name: "Grade 4 special",
        items: { create: [{ componentId: tuition, amount: 1800 }] },
      },
    });
    await prisma.classFeeStructure.create({
      data: { classId: grade[4], structureId: own.id },
    });

    const res = await copyFeeStructures({
      fromSessionId: session["2026-27"],
      toSessionId: session["2027-28"],
      increasePercent: 7,
      roundTo: 10,
      includeConcessions: false,
    });
    expect(res).toMatchObject({
      copied: ["Grade 4 fees", "Grade 5 fees"],
      classesAssigned: 1,
      skippedClasses: ["Grade 4"],
      concessions: 0,
    });
    expect(await structuresIn("2027-28")).toEqual({
      // 2,100 × 1.07 = 2,247 → 2,250; the 3,000 default × 1.07 = 3,210.
      "Grade 4 fees": {
        classes: [],
        items: { "Tuition Fee": 2250, "Annual Charges": 3210 },
      },
      "Grade 4 special": {
        classes: ["Grade 4"],
        items: { "Tuition Fee": 1800 },
      },
      // 2,500 × 1.07 = 2,675 → 2,680.
      "Grade 5 fees": {
        classes: ["Grade 5"],
        items: { "Tuition Fee": 2680, "Annual Charges": 3210 },
      },
    });
  });

  it("bills the new session from the copied fees, concession included", async () => {
    signInAs(adminId, "SCHOOL_ADMIN");
    const res = await generateMonthlyFees(
      session["2026-27"],
      [grade[4]],
      "",
      "2026-04-10",
      "2026-04",
    );
    expect(res).toMatchObject({ generatedCount: 1 });
    const charge = await prisma.feeCharge.findFirstOrThrow({
      where: { studentId: pupil, sessionId: session["2026-27"] },
      include: { items: { include: { component: true } } },
    });
    expect(
      Object.fromEntries(
        charge.items.map((i) => [i.component.name, Number(i.amount)]),
      ),
    ).toEqual({ "Tuition Fee": 1800, "Annual Charges": 3000 });
  });

  it("needs two different sessions of the school, and fee rights", async () => {
    signInAs(adminId, "SCHOOL_ADMIN");
    expect(
      await copyFeeStructures({
        fromSessionId: session["2026-27"],
        toSessionId: session["2026-27"],
      }),
    ).toMatchObject({ error: "Choose two different sessions" });
    expect(
      await copyFeeStructures({
        fromSessionId: session["2026-27"],
        toSessionId: "someone-elses-session",
      }),
    ).toMatchObject({ error: "Academic session not found in your school" });
    signInAs(teacherId, "TEACHER");
    expect(
      await copyFeeStructures({
        fromSessionId: session["2025-26"],
        toSessionId: session["2027-28"],
      }),
    ).toEqual({ error: "Unauthorized" });
  });
});
