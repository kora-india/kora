import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma, purgeSchool } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { getPromotionPlan, promoteStudents, undoPromotion } from "../promotion";

const schoolId = `promo-${Math.random().toString(36).slice(2, 8)}`;

const signInAs = (id: string, role: string) =>
  vi.mocked(auth).mockResolvedValue({
    user: { id, schoolId, role, name: role },
  } as any);

describe("promoting students at the end of the year", () => {
  let adminId: string;
  let teacherId: string;
  const cls: Record<string, { id: string; sections: Record<string, string> }> =
    {};
  const kid: Record<string, string> = {};
  let busId: string;

  /** Where a student is now: "Grade 5-A #2", or "left". */
  const placement = async (name: string) => {
    const s = await prisma.student.findUniqueOrThrow({
      where: { id: kid[name] },
      include: { class: true, section: true },
    });
    return s.isActive
      ? `${s.class.name}-${s.section.name} #${s.rollNumber}`
      : "left";
  };
  const everyone = async () =>
    Object.fromEntries(
      await Promise.all(
        Object.keys(kid).map(async (n) => [n, await placement(n)]),
      ),
    );

  const defaultMoves = () => [
    {
      fromClassId: cls["Grade 4"].id,
      to: { kind: "CLASS", classId: cls["Grade 5"].id },
    },
    {
      fromClassId: cls["Grade 5"].id,
      to: { kind: "CLASS", classId: cls["Grade 6"].id },
    },
    { fromClassId: cls["Grade 6"].id, to: { kind: "GRADUATE" } },
  ];
  const exceptions = () => [
    { studentId: kid.Meera, action: "REPEAT" },
    { studentId: kid.Anu, action: "LEAVE" },
  ];

  beforeAll(async () => {
    await prisma.school.create({
      data: {
        id: schoolId,
        name: "Promo School",
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

    for (const [name, grade, sections] of [
      ["Grade 4", 4, ["A", "B"]],
      ["Grade 5", 5, ["A"]],
      ["Grade 6", 6, ["A"]],
    ] as const) {
      const c = await prisma.class.create({ data: { schoolId, name, grade } });
      cls[name] = { id: c.id, sections: {} };
      for (const s of sections) {
        cls[name].sections[s] = (
          await prisma.section.create({
            data: { schoolId, classId: c.id, name: s },
          })
        ).id;
      }
    }
    let n = 0;
    for (const [name, className, section, roll] of [
      ["Zara", "Grade 4", "A", "1"],
      ["Arjun", "Grade 4", "A", "2"],
      ["Meera", "Grade 4", "A", "3"],
      ["Kabir", "Grade 4", "B", "1"],
      ["Ravi", "Grade 5", "A", "1"],
      ["Anu", "Grade 5", "A", "2"],
      ["Sita", "Grade 6", "A", "1"],
      ["Tom", "Grade 6", "A", "2"],
    ] as const) {
      kid[name] = (
        await prisma.student.create({
          data: {
            schoolId,
            name,
            classId: cls[className].id,
            sectionId: cls[className].sections[section],
            rollNumber: roll,
            admissionNumber: `ADM-${++n}`,
            parentName: "Parent",
            parentPhone: "9999999999",
          },
        })
      ).id;
    }
    // Sita rides the bus.
    const session = await prisma.academicSession.create({
      data: {
        schoolId,
        name: "This year",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        isCurrent: true,
      },
    });
    const route = await prisma.transportRoute.create({
      data: {
        schoolId,
        name: "West",
        startPoint: "A",
        endPoint: "B",
        stops: { create: [{ stopName: "Gate", sequenceOrder: 1 }] },
      },
      include: { stops: true },
    });
    busId = (
      await prisma.studentTransport.create({
        data: {
          schoolId,
          studentId: kid.Sita,
          sessionId: session.id,
          routeId: route.id,
          stopId: route.stops[0].id,
          distanceKm: 2,
          monthlyFee: 600,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await purgeSchool(prisma, schoolId);
  });

  it("suggests the next grade for each class, and graduation from the top", async () => {
    signInAs(adminId, "SCHOOL_ADMIN");
    const plan = await getPromotionPlan();
    if (!plan.success) throw new Error(plan.error);
    expect(
      plan.classes.map((c) => [c.name, c.studentCount, c.defaultDestination]),
    ).toEqual([
      ["Grade 4", 4, { kind: "CLASS", classId: cls["Grade 5"].id }],
      ["Grade 5", 2, { kind: "CLASS", classId: cls["Grade 6"].id }],
      ["Grade 6", 2, { kind: "GRADUATE" }],
    ]);
    expect(plan.lastPromotion).toBeNull();
  });

  it("is for school admins only", async () => {
    signInAs(teacherId, "TEACHER");
    expect(
      await promoteStudents({
        moves: defaultMoves(),
        exceptions: [],
        renumber: true,
      }),
    ).toMatchObject({ error: expect.stringMatching(/permission/i) });
    expect(await getPromotionPlan()).toMatchObject({
      error: expect.any(String),
    });
  });

  it("refuses clashing roll numbers, and changes nothing", async () => {
    signInAs(adminId, "SCHOOL_ADMIN");
    const before = await everyone();
    const res = await promoteStudents({
      moves: defaultMoves(),
      exceptions: exceptions(),
      renumber: false,
    });
    // Kabir (4-B #1) and Zara (4-A #1) would both be Grade 5-A #1.
    expect(res).toMatchObject({
      error: expect.stringMatching(/roll 1 in Grade 5-A \(Kabir and Zara\)/),
    });
    expect(await everyone()).toEqual(before);
  });

  it("moves every class up, keeps repeaters, lets leavers go, and renumbers", async () => {
    signInAs(adminId, "SCHOOL_ADMIN");
    const res = await promoteStudents({
      moves: defaultMoves(),
      exceptions: exceptions(),
      renumber: true,
    });
    expect(res).toMatchObject({
      success: true,
      summary: { PROMOTED: 4, REPEATED: 1, STAYED: 0, GRADUATED: 2, LEFT: 1 },
    });
    expect(await everyone()).toEqual({
      // Grade 5 has only section A, so 4-B joins it; rolls go by name.
      Arjun: "Grade 5-A #1",
      Kabir: "Grade 5-A #2",
      Zara: "Grade 5-A #3",
      Meera: "Grade 4-A #1",
      Ravi: "Grade 6-A #1",
      Anu: "left",
      Sita: "left",
      Tom: "left",
    });
    // A graduate no longer rides the bus.
    expect(
      (
        await prisma.studentTransport.findUniqueOrThrow({
          where: { id: busId },
        })
      ).status,
    ).toBe("INACTIVE");
    // Every student's year is on record.
    expect(
      await prisma.studentPromotion.count({
        where: { schoolId, batchId: (res as any).batchId },
      }),
    ).toBe(8);

    const plan = await getPromotionPlan();
    expect((plan as any).lastPromotion).toMatchObject({
      batchId: (res as any).batchId,
      counts: { PROMOTED: 4, REPEATED: 1, GRADUATED: 2, LEFT: 1 },
    });
  });

  it("undoes the latest promotion completely, once", async () => {
    signInAs(adminId, "SCHOOL_ADMIN");
    const { lastPromotion } = (await getPromotionPlan()) as any;
    expect(await undoPromotion(lastPromotion.batchId)).toEqual({
      success: true,
      restored: 8,
    });
    expect(await everyone()).toEqual({
      Zara: "Grade 4-A #1",
      Arjun: "Grade 4-A #2",
      Meera: "Grade 4-A #3",
      Kabir: "Grade 4-B #1",
      Ravi: "Grade 5-A #1",
      Anu: "Grade 5-A #2",
      Sita: "Grade 6-A #1",
      Tom: "Grade 6-A #2",
    });
    expect(
      (
        await prisma.studentTransport.findUniqueOrThrow({
          where: { id: busId },
        })
      ).status,
    ).toBe("ACTIVE");
    expect(await undoPromotion(lastPromotion.batchId)).toMatchObject({
      error: "Only the latest promotion can be undone",
    });
    expect(((await getPromotionPlan()) as any).lastPromotion).toBeNull();
  });

  it("refuses a plan that changes nothing", async () => {
    signInAs(adminId, "SCHOOL_ADMIN");
    expect(
      await promoteStudents({
        moves: Object.values(cls).map((c) => ({
          fromClassId: c.id,
          to: { kind: "STAY" },
        })),
        exceptions: [],
        renumber: false,
      }),
    ).toMatchObject({ error: expect.stringMatching(/Nothing would change/) });
  });
});
