import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  beforeAll,
  vi,
} from "vitest";
import { createSections, createClass } from "../classes";
import { prisma } from "@schoolos/db";
import { auth } from "@schoolos/auth";

const schoolId =
  "classes-test-school-" + Math.random().toString(36).substring(7);

describe("Classes & Multiple Sections Management", () => {
  let testClassId: string;

  beforeAll(async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "test-admin", schoolId, role: "SCHOOL_ADMIN" },
    } as any);

    // Cleanup and setup school
    await prisma.school.deleteMany({ where: { id: schoolId } });
    await prisma.school.create({
      data: {
        id: schoolId,
        name: "Classes Test School",
        subdomain: "testschool-" + Math.random().toString(36).substring(7),
      },
    });

    const c = await prisma.class.create({
      data: {
        schoolId,
        name: "Grade 9",
        grade: 9,
      },
    });
    testClassId = c.id;
  });

  afterAll(async () => {
    await prisma.school.deleteMany({ where: { id: schoolId } });
  });

  it("creates multiple sections at once using an array of names", async () => {
    const res = await createSections({
      classId: testClassId,
      names: ["A", "B", "C"],
    });

    expect(res.success).toBe(true);
    expect(res.count).toBe(3);
    expect(res.created).toEqual(["A", "B", "C"]);

    const sections = await prisma.section.findMany({
      where: { classId: testClassId },
      orderBy: { name: "asc" },
    });
    expect(sections.map((s) => s.name)).toEqual(["A", "B", "C"]);
  });

  it("creates multiple sections at once using a comma-separated string", async () => {
    const res = await createSections({
      classId: testClassId,
      names: "Rose, Lotus, Jasmine",
    });

    expect(res.success).toBe(true);
    expect(res.count).toBe(3);

    const sections = await prisma.section.findMany({
      where: { classId: testClassId },
    });
    const names = sections.map((s) => s.name);
    expect(names).toContain("Rose");
    expect(names).toContain("Lotus");
    expect(names).toContain("Jasmine");
  });

  it("skips sections that already exist and creates only new ones", async () => {
    // 'A' already exists from previous test
    const res = await createSections({
      classId: testClassId,
      names: ["A", "D", "E"],
    });

    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
    expect(res.created).toEqual(["D", "E"]);
    expect(res.skipped).toEqual(["A"]);
  });

  it("returns error when all specified sections already exist in the class", async () => {
    const res = await createSections({
      classId: testClassId,
      names: ["A", "B"],
    });

    expect(res.error).toMatch(/already exist/i);
  });

  it("trims whitespace and deduplicates within input", async () => {
    const res = await createSections({
      classId: testClassId,
      names: ["  X  ", "X", "x", "Y"],
    });

    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
    expect(res.created).toEqual(["X", "Y"]);
  });

  it("rejects section names exceeding 20 characters", async () => {
    const res = await createSections({
      classId: testClassId,
      names: ["SuperLongSectionNameExceedingTwentyCharacters"],
    });

    expect(res.error).toMatch(/exceeds 20 characters/i);
  });

  it("creates a class with initial sections at once", async () => {
    const res = await createClass({
      name: "Grade 11",
      grade: 11,
      initialSections: "A, B, C",
    });

    expect(res.success).toBe(true);
    expect(res.id).toBeDefined();

    const sections = await prisma.section.findMany({
      where: { classId: res.id },
      orderBy: { name: "asc" },
    });
    expect(sections.map((s) => s.name)).toEqual(["A", "B", "C"]);
  });
});
