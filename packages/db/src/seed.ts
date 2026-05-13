import {
  PrismaClient, UserRole, SubscriptionPlan,
  AttendanceStatus, FeeStatus, NoticePriority, Gender,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MALE_NAMES = [
  "Aarav Patel", "Arjun Sharma", "Chirag Kumar", "Dev Verma", "Eshan Jain",
  "Gaurav Singh", "Hrithik Gupta", "Ishaan Mehta", "Kabir Nair", "Lakshman Rao",
  "Manav Pandey", "Nikhil Kapoor", "Om Prakash", "Pranav Bhat", "Raj Malhotra",
];

const FEMALE_NAMES = [
  "Aanya Patel", "Bhavna Sharma", "Diya Mishra", "Fatima Ghazi", "Hina Qureshi",
  "Ishita Mehta", "Jaya Reddy", "Kavya Nair", "Lakshmi Rao", "Meera Gupta",
  "Nisha Pandey", "Pooja Kapoor", "Riya Singh", "Shreya Verma", "Tanvi Bhat",
];

const ALL_NAMES = [...MALE_NAMES, ...FEMALE_NAMES];

const TEACHER_DATA = [
  { name: "Priya Nair",    email: "priya@dps.edu.in",   subject: "Mathematics",      grade: 8,  section: "A" },
  { name: "Rahul Verma",   email: "rahul@dps.edu.in",   subject: "Science",          grade: 9,  section: "B" },
  { name: "Anita Roy",     email: "anita@dps.edu.in",   subject: "English",          grade: 10, section: "B" },
  { name: "Suresh Kumar",  email: "suresh@dps.edu.in",  subject: "History",          grade: 7,  section: "A" },
  { name: "Meena Iyer",    email: "meena@dps.edu.in",   subject: "Geography",        grade: 6,  section: "C" },
  { name: "Deepak Sharma", email: "deepak@dps.edu.in",  subject: "Physics",          grade: 11, section: "A" },
  { name: "Sunita Reddy",  email: "sunita@dps.edu.in",  subject: "Chemistry",        grade: 12, section: "B" },
  { name: "Vijay Pillai",  email: "vijay@dps.edu.in",   subject: "Computer Science", grade: 10, section: "A" },
];

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── Passwords (computed once) ─────────────────────────────────────────
  const [adminPw, teacherPw, accountsPw] = await Promise.all([
    bcrypt.hash("admin123", 10),
    bcrypt.hash("teacher123", 10),
    bcrypt.hash("accounts123", 10),
  ]);

  // ── Super Admin ───────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: "super@schoolos.com" },
    update: {},
    create: { email: "super@schoolos.com", password: adminPw, name: "Super Admin", role: UserRole.SUPER_ADMIN },
  });

  // ── School 1: Delhi Public School (PRO) ──────────────────────────────
  const dps = await prisma.school.upsert({
    where: { subdomain: "delhi-public" },
    update: {},
    create: {
      name: "Delhi Public School", subdomain: "delhi-public",
      address: "Sector 15, New Delhi — 110 001", phone: "+91 11 2345 6789",
      email: "admin@dps.edu.in", plan: SubscriptionPlan.PRO, isActive: true,
    },
  });

  const [dpsAdmin] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@dps.edu.in" },
      update: {},
      create: { email: "admin@dps.edu.in", password: adminPw, name: "Arjun Dubey", role: UserRole.SCHOOL_ADMIN, schoolId: dps.id },
    }),
    prisma.user.upsert({
      where: { email: "accounts@dps.edu.in" },
      update: {},
      create: { email: "accounts@dps.edu.in", password: accountsPw, name: "Rekha Sharma", role: UserRole.ACCOUNTANT, schoolId: dps.id },
    }),
  ]);
  console.log("✓ School + admin + accountant");

  // ── Classes & Sections ────────────────────────────────────────────────
  const grades = [6, 7, 8, 9, 10, 11, 12];
  const dpsClasses: Record<number, { id: string; sections: { id: string; name: string }[] }> = {};

  for (const grade of grades) {
    const cls = await prisma.class.upsert({
      where: { schoolId_name: { schoolId: dps.id, name: `Grade ${grade}` } },
      update: {},
      create: { schoolId: dps.id, name: `Grade ${grade}`, grade },
    });
    const sectionNames = grade >= 11 ? ["A", "B"] : ["A", "B", "C"];
    const sections: { id: string; name: string }[] = [];
    for (const sName of sectionNames) {
      const sec = await prisma.section.upsert({
        where: { classId_name: { classId: cls.id, name: sName } },
        update: {},
        create: { schoolId: dps.id, classId: cls.id, name: sName },
      });
      sections.push({ id: sec.id, name: sName });
    }
    dpsClasses[grade] = { id: cls.id, sections };
  }
  console.log("✓ Classes & sections");

  // ── Teachers ──────────────────────────────────────────────────────────
  for (const td of TEACHER_DATA) {
    const u = await prisma.user.upsert({
      where: { email: td.email },
      update: {},
      create: { email: td.email, password: teacherPw, name: td.name, role: UserRole.TEACHER, schoolId: dps.id },
    });
    const cls = dpsClasses[td.grade];
    const sec = cls?.sections.find((s) => s.name === td.section);
    await prisma.teacher.upsert({
      where: { userId: u.id },
      update: {},
      create: { schoolId: dps.id, userId: u.id, name: td.name, email: td.email, subject: td.subject, assignedClassId: cls?.id ?? null, assignedSectionId: sec?.id ?? null },
    });
  }
  console.log("✓ Teachers");

  // ── Students (upsert individually for IDs, only 2 grades for speed) ──
  const dpsStudents: { id: string; classId: string; sectionId: string }[] = [];
  let rollN = 1, admN = 1;

  for (const [grade, names] of [[8, ALL_NAMES.slice(0, 15)], [9, ALL_NAMES.slice(5, 18)]] as [number, string[]][]) {
    const cls = dpsClasses[grade]!;
    const sec = cls.sections[0]!;
    for (const name of names) {
      const admNo = `DPS-${grade}-${String(admN++).padStart(3, "0")}`;
      const existing = await prisma.student.findUnique({ where: { admissionNumber: admNo } });
      if (existing) { dpsStudents.push({ id: existing.id, classId: existing.classId, sectionId: existing.sectionId }); continue; }
      const s = await prisma.student.create({
        data: {
          schoolId: dps.id, classId: cls.id, sectionId: sec.id,
          rollNumber: String(rollN++).padStart(2, "0"), admissionNumber: admNo,
          name, gender: FEMALE_NAMES.includes(name) ? Gender.FEMALE : Gender.MALE,
          parentName: `${name.split(" ")[1]} Family`,
          parentPhone: `+91 98${String(76500000 + admN).slice(-8)}`,
        },
      });
      dpsStudents.push({ id: s.id, classId: s.classId, sectionId: s.sectionId });
    }
  }
  console.log(`✓ ${dpsStudents.length} students`);

  // ── Attendance — BATCH insert (the key fix) ───────────────────────────
  const attendanceRows: {
    schoolId: string; studentId: string; classId: string; sectionId: string;
    date: Date; status: AttendanceStatus; markedById: string;
  }[] = [];

  for (let offset = 42; offset >= 0; offset--) {
    const date = daysAgo(offset);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends
    for (const s of dpsStudents) {
      const r = Math.random();
      attendanceRows.push({
        schoolId: dps.id, studentId: s.id, classId: s.classId, sectionId: s.sectionId,
        date,
        status: r > 0.9 ? AttendanceStatus.ABSENT : r > 0.85 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
        markedById: dpsAdmin.id,
      });
    }
  }

  // Delete existing attendance for these students, then bulk-insert
  await prisma.attendance.deleteMany({ where: { schoolId: dps.id } });
  await prisma.attendance.createMany({ data: attendanceRows });
  console.log(`✓ ${attendanceRows.length} attendance records (batch)`);

  // ── Fees — BATCH insert ───────────────────────────────────────────────
  const feeTypes = [
    { type: "Tuition Fee Q1",  amount: 8400  },
    { type: "Tuition Fee Q2",  amount: 8400  },
    { type: "Annual Dev Fee",  amount: 24000 },
    { type: "Sports & Activity", amount: 3000 },
  ];

  const feeRows: {
    schoolId: string; studentId: string; classId: string;
    feeType: string; amount: number; dueDate: Date; status: FeeStatus;
    paidAt: Date | null; paidAmount: number | null;
  }[] = [];

  for (const s of dpsStudents) {
    for (const f of feeTypes) {
      const r = Math.random();
      const status = r > 0.65 ? FeeStatus.PAID : r > 0.3 ? FeeStatus.PENDING : FeeStatus.OVERDUE;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (r > 0.5 ? 20 : -10));
      feeRows.push({
        schoolId: dps.id, studentId: s.id, classId: s.classId,
        feeType: f.type, amount: f.amount, dueDate, status,
        paidAt: status === FeeStatus.PAID ? new Date(Date.now() - Math.random() * 30 * 86400000) : null,
        paidAmount: status === FeeStatus.PAID ? f.amount : null,
      });
    }
  }

  await prisma.fee.deleteMany({ where: { schoolId: dps.id } });
  await prisma.fee.createMany({ data: feeRows });
  console.log(`✓ ${feeRows.length} fee records (batch)`);

  // ── Notices ───────────────────────────────────────────────────────────
  await prisma.notice.deleteMany({ where: { schoolId: dps.id } });
  await prisma.notice.createMany({
    data: [
      { schoolId: dps.id, title: "Annual Sports Day — 20 May 2025", content: "All students required. Report in sports attire by 7:30 AM.", priority: NoticePriority.HIGH, publishedById: dpsAdmin.id },
      { schoolId: dps.id, title: "Mid-Term Exam Schedule Released", content: "Examinations from June 2–10. Timetable available on portal.", priority: NoticePriority.HIGH, publishedById: dpsAdmin.id },
      { schoolId: dps.id, title: "Parent-Teacher Meeting", content: "PT Meeting Saturday, May 25 for Grade 10 & 12 parents.", priority: NoticePriority.MEDIUM, publishedById: dpsAdmin.id },
      { schoolId: dps.id, title: "Library Book Return Reminder", content: "All borrowed books must be returned by May 15.", priority: NoticePriority.LOW, publishedById: dpsAdmin.id },
    ],
  });
  console.log("✓ Notices");

  // ── Assignments ───────────────────────────────────────────────────────
  const firstTeacher = await prisma.teacher.findFirst({ where: { schoolId: dps.id } });
  if (firstTeacher) {
    await prisma.assignment.deleteMany({ where: { schoolId: dps.id } });
    const cls8 = dpsClasses[8]!;
    const cls9 = dpsClasses[9]!;
    await prisma.assignment.createMany({
      data: [
        { schoolId: dps.id, classId: cls8.id, sectionId: cls8.sections[0]!.id, teacherId: firstTeacher.id, title: "Chapter 5: Algebraic Expressions", description: "Complete all 25 questions. Show working steps.", dueDate: daysAgo(-7) },
        { schoolId: dps.id, classId: cls9.id, sectionId: cls9.sections[0]!.id, teacherId: firstTeacher.id, title: "Newton's Laws — Lab Report", description: "Submit 2-page report with observations and conclusions.", dueDate: daysAgo(-10) },
      ],
    });
    console.log("✓ Assignments");
  }

  // ── School 2 & 3 (light) ──────────────────────────────────────────────
  const greenfield = await prisma.school.upsert({
    where: { subdomain: "greenfield-academy" },
    update: {},
    create: { name: "Greenfield Academy", subdomain: "greenfield-academy", address: "MG Road, Bangalore", email: "admin@greenfield.edu.in", plan: SubscriptionPlan.BASIC, isActive: true },
  });
  await prisma.user.upsert({
    where: { email: "admin@greenfield.edu.in" },
    update: {},
    create: { email: "admin@greenfield.edu.in", password: adminPw, name: "Kavitha Menon", role: UserRole.SCHOOL_ADMIN, schoolId: greenfield.id },
  });

  const sunrise = await prisma.school.upsert({
    where: { subdomain: "sunrise-intl" },
    update: {},
    create: { name: "Sunrise International School", subdomain: "sunrise-intl", address: "Andheri West, Mumbai", email: "admin@sunrise.edu.in", plan: SubscriptionPlan.FREE, isActive: false },
  });
  await prisma.user.upsert({
    where: { email: "admin@sunrise.edu.in" },
    update: {},
    create: { email: "admin@sunrise.edu.in", password: adminPw, name: "Ramesh Joshi", role: UserRole.SCHOOL_ADMIN, schoolId: sunrise.id },
  });
  console.log("✓ Greenfield + Sunrise schools");

  console.log("\n✅ Seed complete!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Super Admin  →  super@schoolos.com   / admin123");
  console.log("  School Admin →  admin@dps.edu.in     / admin123");
  console.log("  Teacher      →  priya@dps.edu.in     / teacher123");
  console.log("  Accountant   →  accounts@dps.edu.in  / accounts123");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
