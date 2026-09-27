import {
  Prisma,
  PrismaClient,
  FeeFrequency,
  Gender,
  UserRole,
} from "@schoolos/db";
import bcrypt from "bcryptjs";
import { createLogger } from "@schoolos/logger";

const logger = createLogger("school-onboarding");

interface SeedParams {
  schoolId: string;
  subdomain: string;
  schoolName: string;
}

/**
 * Prepopulates a newly registered school with essential starter data:
 * - Active Academic Session
 * - 1 Class (Class 1) and Section (A)
 * - 1 Teacher (assigned as Class Teacher)
 * - Generic Fee Components (Tuition, Admission, Annual, Exam, Computer, Transport)
 * - Standard Fee Structure assigned to the class
 * - 1 Student assigned to Class 1-A with Fee Structure assignment
 */
export async function seedInitialSchoolData(
  tx: Prisma.TransactionClient | PrismaClient | any,
  { schoolId, subdomain, schoolName }: SeedParams,
) {
  const cleanSub = subdomain.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Session dates calculation (Starts April 1)
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
  const endYear = startYear + 1;
  const sessionName = `${startYear}-${String(endYear).slice(-2)}`;
  const startDate = new Date(`${startYear}-04-01`);
  const endDate = new Date(`${endYear}-03-31`);

  // Batch 1 (Parallel): Academic Session, Class with nested Section A, and 6 Fee Components
  const [
    session,
    class1,
    tuitionFee,
    admissionFee,
    annualFee,
    examFee,
    computerFee,
    transportFee,
  ] = await Promise.all([
    tx.academicSession.create({
      data: {
        schoolId,
        name: sessionName,
        startDate,
        endDate,
        isCurrent: true,
      },
    }),
    tx.class.create({
      data: {
        schoolId,
        name: "Class 1",
        grade: 1,
        sections: {
          create: {
            schoolId,
            name: "A",
          },
        },
      },
      include: {
        sections: true,
      },
    }),
    tx.feeComponent.create({
      data: {
        schoolId,
        name: "Tuition Fee",
        category: "Academic",
        amount: 1500,
        frequency: FeeFrequency.MONTHLY,
        isOptional: false,
        isActive: true,
      },
    }),
    tx.feeComponent.create({
      data: {
        schoolId,
        name: "Admission Fee",
        category: "One-Time",
        amount: 5000,
        frequency: FeeFrequency.ONE_TIME,
        isOptional: false,
        isActive: true,
      },
    }),
    tx.feeComponent.create({
      data: {
        schoolId,
        name: "Annual Charges",
        category: "Institutional",
        amount: 3000,
        frequency: FeeFrequency.YEARLY,
        isOptional: false,
        isActive: true,
      },
    }),
    tx.feeComponent.create({
      data: {
        schoolId,
        name: "Examination Fee",
        category: "Academic",
        amount: 600,
        frequency: FeeFrequency.QUARTERLY,
        isOptional: false,
        isActive: true,
      },
    }),
    tx.feeComponent.create({
      data: {
        schoolId,
        name: "Computer & Lab Fee",
        category: "Facility",
        amount: 400,
        frequency: FeeFrequency.MONTHLY,
        isOptional: false,
        isActive: true,
      },
    }),
    tx.feeComponent.create({
      data: {
        schoolId,
        name: "Transport Fee",
        category: "Transport",
        amount: 1200,
        frequency: FeeFrequency.MONTHLY,
        isOptional: true,
        isActive: true,
      },
    }),
  ]);

  const sectionA = class1.sections[0];
  const teacherEmail = `teacher.${cleanSub}.${Date.now().toString(36)}@schoolos.com`;
  const teacherPassword = await bcrypt.hash("Teacher@123", 10);

  // Batch 2 (Parallel): Teacher User & Fee Structure (with nested items and class assignment)
  const [teacherUser, feeStructure] = await Promise.all([
    tx.user.create({
      data: {
        schoolId,
        name: "Priya Sharma",
        email: teacherEmail,
        password: teacherPassword,
        role: UserRole.TEACHER,
        phone: "9876543211",
        isActive: true,
      },
    }),
    tx.feeStructure.create({
      data: {
        schoolId,
        name: "Primary Fee Structure",
        description:
          "Standard starter structure with Tuition, Admission, Annual, Exam, and Lab fees.",
        sessionId: session.id,
        status: "ACTIVE",
        items: {
          create: [
            { componentId: tuitionFee.id, amount: 1500 },
            { componentId: admissionFee.id, amount: 5000 },
            { componentId: annualFee.id, amount: 3000 },
            { componentId: examFee.id, amount: 600 },
            { componentId: computerFee.id, amount: 400 },
          ],
        },
        classAssignments: {
          create: {
            classId: class1.id,
          },
        },
      },
    }),
  ]);

  // Batch 3 (Parallel): Teacher profile & Student with fee assignment
  const [teacher, student] = await Promise.all([
    tx.teacher.create({
      data: {
        schoolId,
        userId: teacherUser.id,
        name: "Priya Sharma",
        email: teacherEmail,
        phone: "9876543211",
        subject: "Mathematics & Science",
        qualification: "B.Ed, M.Sc",
        assignedClassId: class1.id,
        assignedSectionId: sectionA.id,
        isActive: true,
        classTeacherOf: {
          connect: { id: class1.id },
        },
        assignedSections: {
          create: {
            schoolId,
            classId: class1.id,
            sectionId: sectionA.id,
          },
        },
      },
    }),
    tx.student.create({
      data: {
        schoolId,
        classId: class1.id,
        sectionId: sectionA.id,
        name: "Aarav Sharma",
        rollNumber: "1",
        admissionNumber: `${cleanSub.toUpperCase()}-${Date.now().toString(36).slice(-4)}001`,
        gender: Gender.MALE,
        parentName: "Rajesh Sharma",
        parentPhone: "9876543210",
        parentEmail: `parent.${cleanSub}@example.com`,
        address: "12, Park Street",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110001",
        isActive: true,
        feeAssignments: {
          create: {
            sessionId: session.id,
            structureId: feeStructure.id,
          },
        },
      },
    }),
  ]);

  logger.info(
    {
      schoolId,
      classId: class1.id,
      teacherId: teacher.id,
      studentId: student.id,
    },
    `[School Prepopulated] Starter class, student, teacher, and fee components initialized for ${schoolName}`,
  );

  return {
    session,
    class: class1,
    section: sectionA,
    teacher,
    student,
    feeStructure,
  };
}
