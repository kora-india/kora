import { PrismaClient, UserRole, SubscriptionPlan, AttendanceStatus, FeeStatus, NoticePriority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Super Admin ──────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: "super@schoolos.com" },
    update: {},
    create: {
      email: "super@schoolos.com",
      password: await bcrypt.hash("admin123", 10),
      name: "Super Admin",
      role: UserRole.SUPER_ADMIN,
      schoolId: null,
    },
  });

  // ── School 1: Delhi Public School ────────────────────────
  const school1 = await prisma.school.upsert({
    where: { subdomain: "delhi-public" },
    update: {},
    create: {
      name: "Delhi Public School",
      subdomain: "delhi-public",
      address: "Sector 15, New Delhi, 110001",
      phone: "+91 11 2345 6789",
      email: "admin@dps.edu.in",
      plan: SubscriptionPlan.PRO,
      isActive: true,
    },
  });

  // ── School Admin for School 1 ─────────────────────────────
  const adminUser1 = await prisma.user.upsert({
    where: { email: "admin@dps.edu.in" },
    update: {},
    create: {
      email: "admin@dps.edu.in",
      password: await bcrypt.hash("admin123", 10),
      name: "Arjun Dubey",
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school1.id,
    },
  });

  // ── Classes for School 1 ──────────────────────────────────
  const grades = [6, 7, 8, 9, 10, 11, 12];
  const createdClasses: Record<number, { id: string; sections: { id: string; name: string }[] }> = {};

  for (const grade of grades) {
    const cls = await prisma.class.upsert({
      where: { schoolId_name: { schoolId: school1.id, name: `Grade ${grade}` } },
      update: {},
      create: {
        schoolId: school1.id,
        name: `Grade ${grade}`,
        grade,
      },
    });

    const sectionNames = ["A", "B", "C"];
    const sections = [];
    for (const sName of sectionNames) {
      const sec = await prisma.section.upsert({
        where: { classId_name: { classId: cls.id, name: sName } },
        update: {},
        create: { schoolId: school1.id, classId: cls.id, name: sName },
      });
      sections.push({ id: sec.id, name: sName });
    }
    createdClasses[grade] = { id: cls.id, sections };
  }

  // ── Teachers ──────────────────────────────────────────────
  const teacherData = [
    { name: "Priya Nair", email: "priya@dps.edu.in", subject: "Mathematics", grade: 8, section: "A" },
    { name: "Rahul Verma", email: "rahul@dps.edu.in", subject: "Science", grade: 9, section: "B" },
    { name: "Anita Roy", email: "anita@dps.edu.in", subject: "English", grade: 10, section: "B" },
    { name: "Suresh Kumar", email: "suresh@dps.edu.in", subject: "History", grade: 7, section: "A" },
    { name: "Meena Iyer", email: "meena@dps.edu.in", subject: "Geography", grade: 6, section: "C" },
  ];

  const createdTeachers = [];
  for (const td of teacherData) {
    const user = await prisma.user.upsert({
      where: { email: td.email },
      update: {},
      create: {
        email: td.email,
        password: await bcrypt.hash("teacher123", 10),
        name: td.name,
        role: UserRole.TEACHER,
        schoolId: school1.id,
      },
    });

    const classInfo = createdClasses[td.grade];
    const sectionInfo = classInfo?.sections.find((s) => s.name === td.section);

    const teacher = await prisma.teacher.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        schoolId: school1.id,
        userId: user.id,
        name: td.name,
        email: td.email,
        subject: td.subject,
        assignedClassId: classInfo?.id ?? null,
        assignedSectionId: sectionInfo?.id ?? null,
      },
    });
    createdTeachers.push(teacher);
  }

  // ── Accountant ────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: "accounts@dps.edu.in" },
    update: {},
    create: {
      email: "accounts@dps.edu.in",
      password: await bcrypt.hash("accounts123", 10),
      name: "Rekha Sharma",
      role: UserRole.ACCOUNTANT,
      schoolId: school1.id,
    },
  });

  // ── Students ──────────────────────────────────────────────
  const studentNames = [
    "Aarav Patel", "Bhavna Sharma", "Chirag Kumar", "Diya Mishra", "Eshan Jain",
    "Fatima Ghazi", "Gaurav Singh", "Hina Qureshi", "Ishaan Mehta", "Jaya Reddy",
    "Kabir Nair", "Lakshmi Rao", "Manav Gupta", "Nisha Pandey", "Om Prakash",
  ];

  const createdStudents = [];
  let rollNum = 1;

  for (const grade of [8]) {
    const classInfo = createdClasses[grade];
    const sectionA = classInfo.sections.find((s) => s.name === "A")!;

    for (let i = 0; i < studentNames.length; i++) {
      const student = await prisma.student.upsert({
        where: { admissionNumber: `DPS-${grade}-${String(i + 1).padStart(3, "0")}` },
        update: {},
        create: {
          schoolId: school1.id,
          classId: classInfo.id,
          sectionId: sectionA.id,
          rollNumber: String(rollNum++).padStart(2, "0"),
          admissionNumber: `DPS-${grade}-${String(i + 1).padStart(3, "0")}`,
          name: studentNames[i],
          gender: i % 3 === 1 ? "FEMALE" : "MALE",
          parentName: `Parent of ${studentNames[i]}`,
          parentPhone: `+91 9876${String(500000 + i).padStart(6, "0")}`,
        },
      });
      createdStudents.push(student);
    }
  }

  // ── Attendance (last 7 days) ──────────────────────────────
  const today = new Date();
  for (let d = 6; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    date.setHours(0, 0, 0, 0);

    for (const student of createdStudents) {
      const isPresent = Math.random() > 0.1;
      await prisma.attendance.upsert({
        where: { studentId_date: { studentId: student.id, date } },
        update: {},
        create: {
          schoolId: school1.id,
          studentId: student.id,
          classId: student.classId,
          sectionId: student.sectionId,
          date,
          status: isPresent ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
          markedById: adminUser1.id,
        },
      });
    }
  }

  // ── Fees ──────────────────────────────────────────────────
  const feeTypes = ["Tuition Q1", "Tuition Q2", "Annual Fee", "Sports Fee"];
  for (const student of createdStudents) {
    for (const feeType of feeTypes) {
      const rand = Math.random();
      const status = rand > 0.6 ? FeeStatus.PAID : rand > 0.3 ? FeeStatus.PENDING : FeeStatus.OVERDUE;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (rand > 0.5 ? 15 : -5));

      await prisma.fee.create({
        data: {
          schoolId: school1.id,
          studentId: student.id,
          classId: student.classId,
          feeType,
          amount: feeType === "Annual Fee" ? 24000 : feeType === "Sports Fee" ? 3000 : 8400,
          dueDate,
          status,
          paidAt: status === FeeStatus.PAID ? new Date() : null,
          paidAmount: status === FeeStatus.PAID ? (feeType === "Annual Fee" ? 24000 : feeType === "Sports Fee" ? 3000 : 8400) : null,
        },
      });
    }
  }

  // ── Notices ───────────────────────────────────────────────
  const noticeData = [
    { title: "Annual Sports Day — 20 May 2025", content: "All students are required to participate. Report in sports attire by 7:30 AM.", priority: NoticePriority.HIGH },
    { title: "Mid-Term Exam Schedule Released", content: "Mid-term examinations from June 2–10. Timetable available on portal.", priority: NoticePriority.MEDIUM },
    { title: "Parent-Teacher Meeting", content: "PT Meeting scheduled for Saturday, May 25. Parents of Grade 10 & 12 required.", priority: NoticePriority.LOW },
  ];

  for (const nd of noticeData) {
    await prisma.notice.create({
      data: {
        schoolId: school1.id,
        ...nd,
        publishedById: adminUser1.id,
        isPublished: true,
      },
    });
  }

  // ── School 2 ──────────────────────────────────────────────
  const school2 = await prisma.school.upsert({
    where: { subdomain: "greenfield-academy" },
    update: {},
    create: {
      name: "Greenfield Academy",
      subdomain: "greenfield-academy",
      address: "MG Road, Bangalore, 560001",
      phone: "+91 80 2345 6789",
      email: "admin@greenfield.edu.in",
      plan: SubscriptionPlan.BASIC,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@greenfield.edu.in" },
    update: {},
    create: {
      email: "admin@greenfield.edu.in",
      password: await bcrypt.hash("admin123", 10),
      name: "Kavitha Menon",
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school2.id,
    },
  });

  console.log("✅ Seed complete!");
  console.log("\n📋 Test Credentials:");
  console.log("  Super Admin : super@schoolos.com / admin123");
  console.log("  School Admin: admin@dps.edu.in / admin123");
  console.log("  Teacher     : priya@dps.edu.in / teacher123");
  console.log("  Accountant  : accounts@dps.edu.in / accounts123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
