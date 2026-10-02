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
  classes?: string[];
  academicSession?: string;
}

/**
 * Prepopulates a newly registered school with essential starter data based on user input:
 * - Active Academic Session
 * - User-selected Classes and Sections (defaulting to Section A)
 * - Generic Fee Components (Tuition, Admission, Annual, Exam, Computer, Transport)
 * - Standard Fee Structure assigned to the created classes
 */
export async function seedInitialSchoolData(
  tx: Prisma.TransactionClient | PrismaClient | any,
  {
    schoolId,
    subdomain,
    schoolName,
    classes = ["Class 1"],
    academicSession,
  }: SeedParams,
) {
  const cleanSub = subdomain.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Session dates calculation (Starts April 1)
  let sessionName = academicSession;
  let startDate = new Date();
  let endDate = new Date();

  if (academicSession && academicSession.includes(" - ")) {
    const [startYearStr, endYearStr] = academicSession.split(" - ");
    const startYear = parseInt(startYearStr, 10);
    const endYear = parseInt(endYearStr, 10);
    startDate = new Date(`${startYear}-04-01`);
    endDate = new Date(`${endYear}-03-31`);
  } else {
    const now = new Date();
    const currentYear = now.getFullYear();
    const startYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
    const endYear = startYear + 1;
    sessionName = `${startYear}-${String(endYear).slice(-2)}`;
    startDate = new Date(`${startYear}-04-01`);
    endDate = new Date(`${endYear}-03-31`);
  }

  // Ensure we have at least one class
  const classesToCreate = classes.length > 0 ? classes : ["Class 1"];

  // Batch 1 (Parallel): Academic Session and 6 Fee Components
  const [
    session,
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
        name: sessionName!,
        startDate,
        endDate,
        isCurrent: true,
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

  // Create all selected classes
  const createdClasses = await Promise.all(
    classesToCreate.map((className, index) =>
      tx.class.create({
        data: {
          schoolId,
          name: className,
          grade: index + 1, // Simple grade assignment
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
    ),
  );

  const primaryClass = createdClasses[0];
  const primarySection = primaryClass.sections[0];
  const teacherEmail = `admin.${cleanSub}@schoolos.com`;
  const teacherPassword = await bcrypt.hash("Admin@123", 10);

  // Batch 2 (Parallel): Admin/Teacher User & Fee Structure (with nested items and class assignment)
  const [adminUser, feeStructure] = await Promise.all([
    tx.user.create({
      data: {
        schoolId,
        name: "School Admin",
        email: teacherEmail,
        password: teacherPassword,
        role: UserRole.SCHOOL_ADMIN,
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
          create: createdClasses.map((cls) => ({
            classId: cls.id,
          })),
        },
      },
    }),
  ]);

  logger.info(
    {
      schoolId,
      classesCreated: createdClasses.length,
      adminUserId: adminUser.id,
    },
    `[School Prepopulated] Started classes, fee components, and admin initialized for ${schoolName}`,
  );

  return {
    session,
    classes: createdClasses,
    adminUser,
    feeStructure,
  };
}
