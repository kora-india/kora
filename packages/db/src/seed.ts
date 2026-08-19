import {
  PrismaClient, UserRole, SubscriptionPlan,
  AttendanceStatus, FeeStatus, NoticePriority, Gender, FeeFrequency, PaymentMethod
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Minimal Test Seed...");

  // 1. Cleanup old "Delhi Public School" data
  const oldSchools = await prisma.school.findMany({
    where: { OR: [{ name: "Delhi Public School" }, { subdomain: "delhi-public" }, { subdomain: "test-dps" }] }
  });

  for (const school of oldSchools) {
    console.log(`Cleaning up old school: ${school.name}`);
    
    const users = await prisma.user.findMany({ where: { schoolId: school.id } });
    const userIds = users.map(u => u.id);

    // 1. Unlink Users from School to allow School deletion
    await prisma.user.updateMany({ where: { schoolId: school.id }, data: { schoolId: null } });
    
    // 2. Delete School (this automatically cascade deletes Attendances, Notices, Students, Fees, etc.)
    await prisma.school.delete({ where: { id: school.id } });

    // 3. Delete the orphaned Users (safe now because Attendances and Notices are gone)
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // Password for test users
  const testPassword = await bcrypt.hash("test1234", 10);

  // 2. Create Test School
  const school = await prisma.school.create({
    data: {
      name: "Delhi Public School - Test",
      subdomain: "test-dps",
      address: "Test Address",
      phone: "+91 00000 00000",
      email: "admin@test-dps.com",
      plan: SubscriptionPlan.PRO,
      isActive: true,
    }
  });

  // Admin User
  const admin = await prisma.user.create({
    data: {
      email: "admin@test-dps.com",
      password: testPassword,
      name: "Test Admin",
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
    }
  });

  // 3. Academic Sessions
  const prevSession = await prisma.academicSession.create({
    data: {
      schoolId: school.id,
      name: "2025-26",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2026-03-31"),
      isCurrent: false,
    }
  });

  const currSession = await prisma.academicSession.create({
    data: {
      schoolId: school.id,
      name: "2026-27",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      isCurrent: true,
    }
  });

  // 4. Classes
  const classes = await Promise.all([
    prisma.class.create({ data: { schoolId: school.id, name: "Class 2", grade: 2 } }),
    prisma.class.create({ data: { schoolId: school.id, name: "Class 3", grade: 3 } }),
    prisma.class.create({ data: { schoolId: school.id, name: "Class 4", grade: 4 } }),
    prisma.class.create({ data: { schoolId: school.id, name: "Class 5", grade: 5 } }),
  ]);
  const c2 = classes[0], c3 = classes[1], c4 = classes[2], c5 = classes[3];

  // 5. Sections
  const sections = await Promise.all([
    prisma.section.create({ data: { schoolId: school.id, classId: c2.id, name: "A" } }),
    prisma.section.create({ data: { schoolId: school.id, classId: c3.id, name: "A" } }),
    prisma.section.create({ data: { schoolId: school.id, classId: c3.id, name: "B" } }),
    prisma.section.create({ data: { schoolId: school.id, classId: c4.id, name: "A" } }),
    prisma.section.create({ data: { schoolId: school.id, classId: c5.id, name: "A" } }),
  ]);
  const s2A = sections[0], s3A = sections[1], s3B = sections[2], s4A = sections[3], s5A = sections[4];

  // 6. Subjects & Teachers
  const teacherData = [
    { name: "Amit Sharma", email: "amit@test-dps.com", subject: "Mathematics" },
    { name: "Priya Singh", email: "priya@test-dps.com", subject: "Science" },
    { name: "Rahul Verma", email: "rahul@test-dps.com", subject: "English" },
    { name: "Neha Gupta", email: "neha@test-dps.com", subject: "Computer" },
    { name: "Sanjay Kumar", email: "sanjay@test-dps.com", subject: "Social Science" },
  ];

  const teachers = [];
  for (const t of teacherData) {
    const user = await prisma.user.create({
      data: { email: t.email, password: testPassword, name: t.name, role: UserRole.TEACHER, schoolId: school.id }
    });
    const teacher = await prisma.teacher.create({
      data: { schoolId: school.id, userId: user.id, name: t.name, email: t.email, subject: t.subject }
    });
    teachers.push(teacher);
  }

  // 7. Fee Components
  const fc = {
    tuition: await prisma.feeComponent.create({ data: { schoolId: school.id, name: "Tuition Fee", amount: 1000, frequency: FeeFrequency.MONTHLY } }),
    lab: await prisma.feeComponent.create({ data: { schoolId: school.id, name: "Lab Fee", amount: 500, frequency: FeeFrequency.MONTHLY } }),
    computer: await prisma.feeComponent.create({ data: { schoolId: school.id, name: "Computer Fee", amount: 300, frequency: FeeFrequency.MONTHLY } }),
    library: await prisma.feeComponent.create({ data: { schoolId: school.id, name: "Library Fee", amount: 200, frequency: FeeFrequency.MONTHLY } }),
    transport: await prisma.feeComponent.create({ data: { schoolId: school.id, name: "Transport Fee", amount: 1500, frequency: FeeFrequency.MONTHLY, isOptional: true } }),
    annual: await prisma.feeComponent.create({ data: { schoolId: school.id, name: "Annual Fee", amount: 5000, frequency: FeeFrequency.YEARLY } }),
    exam: await prisma.feeComponent.create({ data: { schoolId: school.id, name: "Examination Fee", amount: 500, frequency: FeeFrequency.QUARTERLY } }),
    admission: await prisma.feeComponent.create({ data: { schoolId: school.id, name: "Admission Fee", amount: 5000, frequency: FeeFrequency.ONE_TIME } }),
    readmission: await prisma.feeComponent.create({ data: { schoolId: school.id, name: "Readmission Fee", amount: 2000, frequency: FeeFrequency.ONE_TIME } }),
  };

  // 8. Fee Structures
  const fsPrimary = await prisma.feeStructure.create({
    data: { schoolId: school.id, name: "Primary Structure", sessionId: currSession.id, 
            items: { create: [{ componentId: fc.tuition.id }, { componentId: fc.lab.id }, { componentId: fc.library.id }] } }
  });
  const fsStandard = await prisma.feeStructure.create({
    data: { schoolId: school.id, name: "Standard Structure", sessionId: currSession.id,
            items: { create: [{ componentId: fc.tuition.id }, { componentId: fc.lab.id }, { componentId: fc.computer.id }, { componentId: fc.library.id }] } }
  });
  const fsSenior = await prisma.feeStructure.create({
    data: { schoolId: school.id, name: "Senior Structure", sessionId: currSession.id,
            items: { create: [{ componentId: fc.tuition.id }, { componentId: fc.lab.id }, { componentId: fc.computer.id }, { componentId: fc.library.id }, { componentId: fc.exam.id }] } }
  });

  await prisma.classFeeStructure.createMany({
    data: [
      { classId: c2.id, structureId: fsPrimary.id },
      { classId: c3.id, structureId: fsStandard.id },
      { classId: c4.id, structureId: fsStandard.id },
      { classId: c5.id, structureId: fsSenior.id },
    ]
  });

  // 9. Students
  const studentsData = [
    { name: "Rahul Kumar", class: c3, section: s3A, email: "rahul.test@schoolos.com", parent: "Rajesh Kumar", phone: "9800000001", roll: "1" }, // S1: Normal (Paid)
    { name: "Aman Kumar", class: c3, section: s3A, email: "aman.test@schoolos.com", parent: "Suresh Kumar", phone: "9800000002", roll: "2" }, // S2: Fee Due
    { name: "Priya Kumari", class: c3, section: s3A, email: "priya.test@schoolos.com", parent: "Amit Kumari", phone: "9800000003", roll: "3", gender: Gender.FEMALE }, // S3: Partial
    { name: "Rohit Kumar", class: c3, section: s3B, email: "rohit.test@schoolos.com", parent: "Rajesh Kumar", phone: "9800000001", roll: "4" }, // S4: Advance (Sibling of S1)
    { name: "Sneha Singh", class: c3, section: s3B, email: "sneha.test@schoolos.com", parent: "Vikas Singh", phone: "9800000004", roll: "5", gender: Gender.FEMALE }, // S5: Multi-comp
    { name: "Vikas Kumar", class: c4, section: s4A, email: "vikas.test@schoolos.com", parent: "Arun Kumar", phone: "9800000005", roll: "1" }, // S6: Transport
    { name: "Anjali Kumari", class: c4, section: s4A, email: "anjali.test@schoolos.com", parent: "Ravi Kumar", phone: "9800000006", roll: "2", gender: Gender.FEMALE }, // S7: Concession
    { name: "Karan Kumar", class: c3, section: s3A, email: "karan.test@schoolos.com", parent: "Pramod Kumar", phone: "9800000007", roll: "6" }, // S8: Promotion
    { name: "Pooja Kumari", class: c3, section: s3A, email: "pooja.test@schoolos.com", parent: "Mahesh Kumari", phone: "9800000008", roll: "7", gender: Gender.FEMALE }, // S9: Repeated
    { name: "Arjun Kumar", class: c5, section: s5A, email: "arjun.test@schoolos.com", parent: "Sunil Kumar", phone: "9800000009", roll: "1" }, // S10: New Admission
  ];

  const students = [];
  let admIdx = 1000;
  for (const s of studentsData) {
    const st = await prisma.student.create({
      data: {
        schoolId: school.id, classId: s.class.id, sectionId: s.section.id,
        name: s.name, rollNumber: s.roll, admissionNumber: `DPS-TEST-${admIdx++}`,
        gender: s.gender || Gender.MALE, parentName: s.parent, parentPhone: s.phone, parentEmail: s.email
      }
    });
    students.push(st);
  }

  // Student Overrides & Assignments
  const [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10] = students;

  await prisma.studentFeeAssignment.createMany({
    data: [
      { studentId: s1.id, sessionId: currSession.id, structureId: fsStandard.id },
      { studentId: s2.id, sessionId: currSession.id, structureId: fsStandard.id },
      { studentId: s3.id, sessionId: currSession.id, structureId: fsStandard.id },
      { studentId: s4.id, sessionId: currSession.id, structureId: fsStandard.id },
      { studentId: s5.id, sessionId: currSession.id, structureId: fsStandard.id },
      { studentId: s6.id, sessionId: currSession.id, structureId: fsStandard.id },
      { studentId: s7.id, sessionId: currSession.id, structureId: fsStandard.id },
      { studentId: s8.id, sessionId: currSession.id, structureId: fsStandard.id },
      { studentId: s9.id, sessionId: currSession.id, structureId: fsStandard.id },
      { studentId: s10.id, sessionId: currSession.id, structureId: fsSenior.id },
    ]
  });

  // S6: Transport
  await prisma.studentFeeOverride.create({
    data: { studentId: s6.id, sessionId: currSession.id, componentId: fc.transport.id, amount: 1500 }
  });

  // S7: Concession
  await prisma.studentFeeOverride.create({
    data: { studentId: s7.id, sessionId: currSession.id, componentId: fc.tuition.id, discountAmount: 200 }
  });

  // Helper to generate charge
  async function generateCharge(student: any, title: string, dueDate: Date, components: { comp: any, due: number, paid: number, status: FeeStatus }[]) {
    const allPaid = components.every(c => c.status === FeeStatus.PAID);
    const anyPaid = components.some(c => c.status === FeeStatus.PAID || c.status === FeeStatus.PARTIAL);
    const parentStatus = allPaid ? FeeStatus.PAID : anyPaid ? FeeStatus.PARTIAL : FeeStatus.PENDING;

    return await prisma.feeCharge.create({
      data: {
        schoolId: school.id, studentId: student.id, sessionId: currSession.id,
        title, dueDate, status: parentStatus,
        items: {
          create: components.map(c => ({
            componentId: c.comp.id, amount: c.due, paidAmount: c.paid, status: c.status
          }))
        }
      },
      include: { items: true }
    });
  }

  // 10. Test Scenarios Fee Data
  
  // S1: Fully Paid (April, May, June)
  for (const [month, date] of [["April", "2026-04-10"], ["May", "2026-05-10"], ["June", "2026-06-10"]]) {
    const charge = await generateCharge(s1, `${month} 2026`, new Date(date), [
      { comp: fc.tuition, due: 1000, paid: 1000, status: FeeStatus.PAID },
      { comp: fc.lab, due: 500, paid: 500, status: FeeStatus.PAID },
    ]);
    const pt = await prisma.paymentTransaction.create({
      data: { schoolId: school.id, studentId: s1.id, amount: 1500, receiptNo: `RCP-${month}-S1`, status: "SUCCESS" }
    });
    await prisma.paymentAllocation.createMany({
      data: charge.items.map(i => ({ paymentId: pt.id, chargeItemId: i.id, amount: i.amount }))
    });
  }

  // S2: Fully Due (April, May, June)
  for (const [month, date] of [["April", "2026-04-10"], ["May", "2026-05-10"], ["June", "2026-06-10"]]) {
    await generateCharge(s2, `${month} 2026`, new Date(date), [
      { comp: fc.tuition, due: 1000, paid: 0, status: FeeStatus.PENDING },
      { comp: fc.lab, due: 500, paid: 0, status: FeeStatus.PENDING },
    ]);
  }

  // S3: Partial Payment
  const s3Charge = await generateCharge(s3, "April 2026", new Date("2026-04-10"), [
    { comp: fc.tuition, due: 1000, paid: 500, status: FeeStatus.PARTIAL },
    { comp: fc.lab, due: 500, paid: 0, status: FeeStatus.PENDING },
  ]);
  const pt3 = await prisma.paymentTransaction.create({
    data: { schoolId: school.id, studentId: s3.id, amount: 500, receiptNo: `RCP-Apr-S3`, status: "SUCCESS" }
  });
  await prisma.paymentAllocation.create({
    data: { paymentId: pt3.id, chargeItemId: s3Charge.items.find(i => i.componentId === fc.tuition.id)!.id, amount: 500 }
  });

  // S4: Advance Payment
  const s4Charge = await generateCharge(s4, "April 2026", new Date("2026-04-10"), [
    { comp: fc.tuition, due: 1000, paid: 1000, status: FeeStatus.PAID },
    { comp: fc.lab, due: 500, paid: 500, status: FeeStatus.PAID },
  ]);
  const pt4 = await prisma.paymentTransaction.create({
    data: { schoolId: school.id, studentId: s4.id, amount: 2500, receiptNo: `RCP-Apr-S4`, status: "SUCCESS" } // 1500 due, 2500 paid
  });
  await prisma.paymentAllocation.createMany({
    data: s4Charge.items.map(i => ({ paymentId: pt4.id, chargeItemId: i.id, amount: i.amount }))
  });
  await prisma.advanceLedger.create({
    data: { studentId: s4.id, amount: 1000, description: "Advance from overpayment" }
  });

  // S5: Multiple Component Partial Payment
  const s5Charge = await generateCharge(s5, "April 2026", new Date("2026-04-10"), [
    { comp: fc.tuition, due: 1000, paid: 800, status: FeeStatus.PARTIAL },
    { comp: fc.lab, due: 500, paid: 500, status: FeeStatus.PAID },
    { comp: fc.computer, due: 300, paid: 0, status: FeeStatus.PENDING },
  ]);
  const pt5 = await prisma.paymentTransaction.create({
    data: { schoolId: school.id, studentId: s5.id, amount: 1300, receiptNo: `RCP-Apr-S5`, status: "SUCCESS" }
  });
  await prisma.paymentAllocation.createMany({
    data: [
      { paymentId: pt5.id, chargeItemId: s5Charge.items.find(i => i.componentId === fc.tuition.id)!.id, amount: 800 },
      { paymentId: pt5.id, chargeItemId: s5Charge.items.find(i => i.componentId === fc.lab.id)!.id, amount: 500 },
    ]
  });

  // S6: Transport
  await generateCharge(s6, "April 2026", new Date("2026-04-10"), [
    { comp: fc.tuition, due: 1000, paid: 0, status: FeeStatus.PENDING },
    { comp: fc.transport, due: 1500, paid: 0, status: FeeStatus.PENDING }, // Optional fee correctly generated
  ]);

  // S7: Concession
  await generateCharge(s7, "April 2026", new Date("2026-04-10"), [
    { comp: fc.tuition, due: 800, paid: 0, status: FeeStatus.PENDING }, // Reduced from 1000
    { comp: fc.lab, due: 500, paid: 0, status: FeeStatus.PENDING },
  ]);

  // S8: Readmission (Promoted)
  await generateCharge(s8, "Readmission 2026-27", new Date("2026-04-05"), [
    { comp: fc.readmission, due: 2000, paid: 0, status: FeeStatus.PENDING }
  ]);

  // S10: Admission (New)
  await generateCharge(s10, "Initial Admission", new Date("2026-04-01"), [
    { comp: fc.admission, due: 5000, paid: 0, status: FeeStatus.PENDING },
    { comp: fc.tuition, due: 1000, paid: 0, status: FeeStatus.PENDING },
  ]);


  // 11. Attendance
  const dates = [];
  for(let i=0; i<7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i); dates.push(d);
  }
  const attendanceData = [];
  for (const d of dates) {
    for (const student of students) {
      if (student.classId === c3.id) {
        attendanceData.push({
          schoolId: school.id, studentId: student.id, classId: student.classId, sectionId: student.sectionId,
          date: d, status: Math.random() > 0.8 ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT,
          markedById: admin.id
        });
      }
    }
  }
  await prisma.attendance.createMany({ data: attendanceData });

  // 12. Assignments
  await prisma.assignment.createMany({
    data: [
      { schoolId: school.id, classId: c3.id, sectionId: s3A.id, teacherId: teachers[0].id, title: "Algebra Practice", dueDate: new Date(Date.now() + 86400000*3), description: "Solve page 45" },
      { schoolId: school.id, classId: c3.id, sectionId: s3A.id, teacherId: teachers[1].id, title: "Plants and Photosynthesis", dueDate: new Date(Date.now() + 86400000*5), description: "Draw a diagram" },
      { schoolId: school.id, classId: c4.id, sectionId: s4A.id, teacherId: teachers[2].id, title: "Essay Writing", dueDate: new Date(Date.now() + 86400000*2), description: "My favorite book" },
    ]
  });

  // 13. Notices
  await prisma.notice.createMany({
    data: [
      { schoolId: school.id, publishedById: admin.id, title: "Parent Teacher Meeting", content: "All parents...", targetClassId: null },
      { schoolId: school.id, publishedById: admin.id, title: "Independence Day", content: "Flag hoisting...", targetClassId: null },
      { schoolId: school.id, publishedById: admin.id, title: "Fee Payment Reminder", content: "Due soon.", targetClassId: c3.id },
      { schoolId: school.id, publishedById: admin.id, title: "Science Exhibition", content: "Prepare projects.", targetClassId: c4.id },
    ]
  });

  console.log("✅ Minimal Comprehensive Test Seed Complete!");
  console.log("\n📋 Test Credentials:");
  console.log("  Admin Email: admin@test-dps.com");
  console.log("  Password:    test1234\n");
}

main().catch(console.error).finally(() => prisma.$disconnect());
