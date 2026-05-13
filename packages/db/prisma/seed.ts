import { PrismaClient, UserRole, PlanType, AttendanceStatus, FeeStatus, NoticePriority, NoticeTarget } from "../src/generated";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // ── Super Admin ──────────────────────────────────────────
  const superAdminPassword = await bcrypt.hash("superadmin123", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@schoolos.com" },
    update: {},
    create: {
      email: "superadmin@schoolos.com",
      name: "Super Admin",
      password: superAdminPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log("✅ Super admin created:", superAdmin.email);

  // ── School 1 ─────────────────────────────────────────────
  const school1 = await prisma.school.upsert({
    where: { code: "DPS001" },
    update: {},
    create: {
      name: "Delhi Public School",
      code: "DPS001",
      subdomain: "dps",
      address: "123 School Road, Sector 14",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
      phone: "+91-11-23456789",
      email: "admin@dps.schoolos.com",
      website: "https://dps.schoolos.com",
      plan: PlanType.PRO,
      isActive: true,
      maxStudents: 2000,
      maxTeachers: 150,
    },
  });

  // ── School 1: Admin ───────────────────────────────────────
  const adminPassword = await bcrypt.hash("admin123", 12);
  const schoolAdmin = await prisma.user.upsert({
    where: { email: "admin@dps.schoolos.com" },
    update: {},
    create: {
      email: "admin@dps.schoolos.com",
      name: "Arjun Dubey",
      password: adminPassword,
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school1.id,
      isActive: true,
    },
  });

  // ── School 1: Accountant ──────────────────────────────────
  const accountantPassword = await bcrypt.hash("accountant123", 12);
  await prisma.user.upsert({
    where: { email: "accounts@dps.schoolos.com" },
    update: {},
    create: {
      email: "accounts@dps.schoolos.com",
      name: "Sunita Sharma",
      password: accountantPassword,
      role: UserRole.ACCOUNTANT,
      schoolId: school1.id,
      isActive: true,
    },
  });

  // ── Classes ───────────────────────────────────────────────
  const classGrades = [
    { name: "Grade 6", displayName: "Class VI", orderIndex: 6 },
    { name: "Grade 7", displayName: "Class VII", orderIndex: 7 },
    { name: "Grade 8", displayName: "Class VIII", orderIndex: 8 },
    { name: "Grade 9", displayName: "Class IX", orderIndex: 9 },
    { name: "Grade 10", displayName: "Class X", orderIndex: 10 },
    { name: "Grade 11", displayName: "Class XI", orderIndex: 11 },
    { name: "Grade 12", displayName: "Class XII", orderIndex: 12 },
  ];

  const classes = await Promise.all(
    classGrades.map((g) =>
      prisma.class.upsert({
        where: { schoolId_name: { schoolId: school1.id, name: g.name } },
        update: {},
        create: { schoolId: school1.id, ...g },
      })
    )
  );

  // ── Sections for Grade 8 ──────────────────────────────────
  const grade8 = classes[2]; // Grade 8
  const sections = await Promise.all(
    ["A", "B", "C"].map((s) =>
      prisma.section.upsert({
        where: { schoolId_classId_name: { schoolId: school1.id, classId: grade8.id, name: s } },
        update: {},
        create: {
          schoolId: school1.id,
          classId: grade8.id,
          name: s,
          displayName: `Section ${s}`,
          capacity: 42,
        },
      })
    )
  );
  const sectionA = sections[0];
  const sectionB = sections[1];

  // Sections for Grade 9
  const grade9 = classes[3];
  const grade9Sections = await Promise.all(
    ["A", "B"].map((s) =>
      prisma.section.upsert({
        where: { schoolId_classId_name: { schoolId: school1.id, classId: grade9.id, name: s } },
        update: {},
        create: { schoolId: school1.id, classId: grade9.id, name: s, displayName: `Section ${s}`, capacity: 40 },
      })
    )
  );

  // ── Subjects ──────────────────────────────────────────────
  const subjectData = [
    { name: "Mathematics", code: "MATH" },
    { name: "Science", code: "SCI" },
    { name: "English", code: "ENG" },
    { name: "Hindi", code: "HIN" },
    { name: "Social Studies", code: "SST" },
    { name: "Computer Science", code: "CS" },
    { name: "Physical Education", code: "PE" },
  ];

  const subjects = await Promise.all(
    subjectData.map((s) =>
      prisma.subject.upsert({
        where: { schoolId_code: { schoolId: school1.id, code: s.code } },
        update: {},
        create: { schoolId: school1.id, ...s },
      })
    )
  );

  // ── Teachers ──────────────────────────────────────────────
  const teacherPassword = await bcrypt.hash("teacher123", 12);

  const teacherData = [
    { name: "Priya Nair", email: "priya.nair@dps.schoolos.com", emp: "EMP001", spec: "Mathematics", sectionId: sectionA.id },
    { name: "Rahul Verma", email: "rahul.verma@dps.schoolos.com", emp: "EMP002", spec: "Science", sectionId: sectionB.id },
    { name: "Anita Roy", email: "anita.roy@dps.schoolos.com", emp: "EMP003", spec: "English", sectionId: grade9Sections[0].id },
    { name: "Suresh Kumar", email: "suresh.kumar@dps.schoolos.com", emp: "EMP004", spec: "Hindi", sectionId: null },
  ];

  const teachers: any[] = [];
  for (const td of teacherData) {
    const nameParts = td.name.split(" ");
    const user = await prisma.user.upsert({
      where: { email: td.email },
      update: {},
      create: {
        email: td.email,
        name: td.name,
        password: teacherPassword,
        role: UserRole.TEACHER,
        schoolId: school1.id,
        isActive: true,
      },
    });

    const teacher = await prisma.teacher.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        schoolId: school1.id,
        userId: user.id,
        employeeId: td.emp,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" "),
        specialization: td.spec,
        assignedSectionId: td.sectionId,
        assignedClassId: td.sectionId ? grade8.id : undefined,
      },
    });
    teachers.push(teacher);
  }

  const teacherPriya = teachers[0];

  // ── Students for Grade 8A ─────────────────────────────────
  const studentData = [
    { first: "Aarav", last: "Patel", roll: "8A-001", parent: "Ravi Patel", parentPhone: "+91-98765-43210" },
    { first: "Bhavna", last: "Sharma", roll: "8A-002", parent: "Sita Sharma", parentPhone: "+91-98765-43211" },
    { first: "Chirag", last: "Kumar", roll: "8A-003", parent: "Sunil Kumar", parentPhone: "+91-98765-43212" },
    { first: "Diya", last: "Mishra", roll: "8A-004", parent: "Pradeep Mishra", parentPhone: "+91-98765-43213" },
    { first: "Eshan", last: "Jain", roll: "8A-005", parent: "Manish Jain", parentPhone: "+91-98765-43214" },
    { first: "Fatima", last: "Ghazi", roll: "8A-006", parent: "Ahmed Ghazi", parentPhone: "+91-98765-43215" },
    { first: "Gaurav", last: "Singh", roll: "8A-007", parent: "Harpal Singh", parentPhone: "+91-98765-43216" },
    { first: "Hina", last: "Kapoor", roll: "8A-008", parent: "Vikram Kapoor", parentPhone: "+91-98765-43217" },
    { first: "Ishaan", last: "Mehta", roll: "8A-009", parent: "Rajesh Mehta", parentPhone: "+91-98765-43218" },
    { first: "Jyoti", last: "Yadav", roll: "8A-010", parent: "Ramesh Yadav", parentPhone: "+91-98765-43219" },
  ];

  const students: any[] = [];
  let admNum = 1001;
  for (const sd of studentData) {
    const s = await prisma.student.upsert({
      where: { admissionNumber: `DPS-2024-${admNum}` },
      update: {},
      create: {
        schoolId: school1.id,
        sectionId: sectionA.id,
        rollNumber: sd.roll,
        admissionNumber: `DPS-2024-${admNum}`,
        firstName: sd.first,
        lastName: sd.last,
        parentName: sd.parent,
        parentPhone: sd.parentPhone,
        isActive: true,
      },
    });
    students.push(s);
    admNum++;
  }

  // ── Attendance (last 7 days) ──────────────────────────────
  const today = new Date();
  for (let d = 6; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateOnly = new Date(date.toISOString().split("T")[0]);

    for (const student of students) {
      const rand = Math.random();
      const status = rand > 0.15 ? AttendanceStatus.PRESENT : rand > 0.05 ? AttendanceStatus.ABSENT : AttendanceStatus.LATE;

      await prisma.attendance.upsert({
        where: { schoolId_studentId_date: { schoolId: school1.id, studentId: student.id, date: dateOnly } },
        update: {},
        create: {
          schoolId: school1.id,
          studentId: student.id,
          sectionId: sectionA.id,
          teacherId: teacherPriya.id,
          date: dateOnly,
          status,
        },
      });
    }
  }

  // ── Fees ──────────────────────────────────────────────────
  const feeStatuses = [FeeStatus.PAID, FeeStatus.PAID, FeeStatus.PENDING, FeeStatus.PAID, FeeStatus.OVERDUE, FeeStatus.PAID, FeeStatus.PAID, FeeStatus.PENDING, FeeStatus.PAID, FeeStatus.PAID];
  for (let i = 0; i < students.length; i++) {
    await prisma.fee.create({
      data: {
        schoolId: school1.id,
        studentId: students[i].id,
        classId: grade8.id,
        title: "Tuition Fee - Q2 2024-25",
        amount: 8400,
        dueDate: new Date("2024-05-15"),
        status: feeStatuses[i],
        feeType: "TUITION",
        month: "2024-05",
        academicYear: "2024-25",
      },
    });
  }

  // ── Notices ───────────────────────────────────────────────
  await prisma.notice.createMany({
    data: [
      {
        schoolId: school1.id,
        teacherId: teacherPriya.id,
        title: "Annual Sports Day — 20 May 2025",
        content: "All students are required to participate in the Annual Sports Day. Students should report in sports attire by 7:30 AM on the school ground.",
        target: NoticeTarget.ALL,
        priority: NoticePriority.HIGH,
        isPublished: true,
        publishedAt: new Date("2024-05-10"),
        expiresAt: new Date("2024-05-20"),
      },
      {
        schoolId: school1.id,
        teacherId: teacherPriya.id,
        sectionId: sectionA.id,
        title: "Mid-Term Exam Timetable",
        content: "Mid-term examinations for Grade 8A will be held from June 2-10. Please download the timetable from the portal.",
        target: NoticeTarget.CLASS,
        priority: NoticePriority.MEDIUM,
        isPublished: true,
        publishedAt: new Date("2024-05-08"),
      },
      {
        schoolId: school1.id,
        title: "Parent-Teacher Meeting — Grade 8 & 9",
        content: "Parent-Teacher Meeting is scheduled for Saturday, May 25. Parents of Grade 8 and 9 students are requested to attend between 10 AM and 1 PM.",
        target: NoticeTarget.PARENTS,
        priority: NoticePriority.MEDIUM,
        isPublished: true,
        publishedAt: new Date("2024-05-06"),
      },
    ],
    skipDuplicates: true,
  });

  // ── Assignments ───────────────────────────────────────────
  await prisma.assignment.createMany({
    data: [
      {
        schoolId: school1.id,
        teacherId: teacherPriya.id,
        sectionId: sectionA.id,
        title: "Chapter 5 - Algebra Exercises",
        description: "Complete all exercises from Chapter 5 (Page 78-85). Show full working for each problem.",
        subject: "Mathematics",
        dueDate: new Date("2024-05-20"),
      },
      {
        schoolId: school1.id,
        teacherId: teacherPriya.id,
        sectionId: sectionA.id,
        title: "Geometry Project",
        description: "Create a poster showing at least 5 real-world examples of geometric shapes with measurements.",
        subject: "Mathematics",
        dueDate: new Date("2024-05-28"),
      },
    ],
    skipDuplicates: true,
  });

  // ── Timetable ─────────────────────────────────────────────
  const mathSubject = subjects[0];
  const timetableData = [
    { day: 0, start: "09:00", end: "09:45" },
    { day: 1, start: "09:00", end: "09:45" },
    { day: 2, start: "11:00", end: "11:45" },
    { day: 3, start: "09:00", end: "09:45" },
    { day: 4, start: "02:00", end: "02:45" },
  ];

  for (const t of timetableData) {
    await prisma.timetable.create({
      data: {
        schoolId: school1.id,
        teacherId: teacherPriya.id,
        classId: grade8.id,
        subjectId: mathSubject.id,
        dayOfWeek: t.day,
        startTime: t.start,
        endTime: t.end,
        room: "Room 201",
      },
    });
  }

  // ── School 2 (demo) ───────────────────────────────────────
  const school2 = await prisma.school.upsert({
    where: { code: "SVM002" },
    update: {},
    create: {
      name: "St. Xavier's High School",
      code: "SVM002",
      subdomain: "sxhs",
      city: "Mumbai",
      state: "Maharashtra",
      plan: PlanType.STARTER,
      isActive: true,
      maxStudents: 800,
      maxTeachers: 60,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@sxhs.schoolos.com" },
    update: {},
    create: {
      email: "admin@sxhs.schoolos.com",
      name: "Mary D'Souza",
      password: adminPassword,
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school2.id,
      isActive: true,
    },
  });

  console.log("✅ Seed complete!");
  console.log("\n📋 Demo Credentials:");
  console.log("  Super Admin:    superadmin@schoolos.com  / superadmin123");
  console.log("  School Admin:   admin@dps.schoolos.com   / admin123");
  console.log("  Teacher:        priya.nair@dps.schoolos.com / teacher123");
  console.log("  Accountant:     accounts@dps.schoolos.com  / accountant123");
  console.log("  School 2 Admin: admin@sxhs.schoolos.com  / admin123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
