-- D14: brings migration history in line with schema.prisma.
--
-- Until now these tables, enums, columns and indexes were only ever created by
-- `prisma db push`, so `prisma migrate deploy` on an empty database produced a
-- broken schema. Generated with `prisma migrate diff --from-migrations
-- --to-schema-datamodel`.
--
-- A database that was set up with `db push` already has all of this. Mark the
-- migration as applied there instead of running it:
--   pnpm --filter @schoolos/db exec prisma migrate resolve --applied 20261017000000_sync_untracked_schema

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('UNIT_TEST', 'HALF_YEARLY', 'TERM_1', 'TERM_2', 'FINAL', 'PERIODIC_TEST', 'MONTHLY_TEST');

-- CreateEnum
CREATE TYPE "GradingSystem" AS ENUM ('CBSE_9_POINT', 'PERCENTAGE_LETTER', 'MARKS_ONLY');

-- CreateEnum
CREATE TYPE "SalarySlipStatus" AS ENUM ('DRAFT', 'GENERATED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PayrollPayoutStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "classTeacherId" TEXT;

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "admissionNumberFormat" TEXT DEFAULT '{PREFIX}-{YYYY}-{SEQ:4}',
ADD COLUMN     "admissionNumberPrefix" TEXT DEFAULT 'SCH',
ADD COLUMN     "board" TEXT,
ADD COLUMN     "establishedYear" INTEGER,
ADD COLUMN     "feePaymentMode" TEXT NOT NULL DEFAULT 'ALLOW_PARTIAL',
ADD COLUMN     "gradingSystem" TEXT,
ADD COLUMN     "mediumOfInstruction" TEXT,
ADD COLUMN     "minPartialPaymentAmount" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "minPartialPaymentPercentage" DECIMAL(5,2) DEFAULT 0,
ADD COLUMN     "nextAdmissionNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "officeHoursEnd" TEXT,
ADD COLUMN     "officeHoursStart" TEXT,
ADD COLUMN     "schoolShift" TEXT,
ADD COLUMN     "schoolType" TEXT,
ADD COLUMN     "timezone" TEXT DEFAULT 'Asia/Kolkata',
ADD COLUMN     "website" TEXT,
ADD COLUMN     "workingDays" TEXT[];

-- CreateTable
CREATE TABLE "teacher_sections" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ExamType" NOT NULL DEFAULT 'TERM_1',
    "academicYear" TEXT NOT NULL,
    "gradingSystem" "GradingSystem" NOT NULL DEFAULT 'CBSE_9_POINT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_subjects" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "maxMarks" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "passMarks" DECIMAL(5,2) NOT NULL DEFAULT 33,
    "examDate" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_marks" (
    "id" TEXT NOT NULL,
    "examSubjectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "marksObtained" DECIMAL(5,2),
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_periods" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "teacherId" TEXT,
    "periodId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "room" TEXT,
    "academicYear" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_slips" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "slipNumber" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "basicSalary" DECIMAL(10,2) NOT NULL,
    "allowances" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pfDeduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grossSalary" DECIMAL(10,2) NOT NULL,
    "totalDeductions" DECIMAL(10,2) NOT NULL,
    "netSalary" DECIMAL(10,2) NOT NULL,
    "status" "SalarySlipStatus" NOT NULL DEFAULT 'GENERATED',
    "generatedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_slips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payouts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "salarySlipId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PayrollPayoutStatus" NOT NULL DEFAULT 'PROCESSING',
    "transactionId" TEXT NOT NULL,
    "reference" TEXT,
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_sections_schoolId_idx" ON "teacher_sections"("schoolId");

-- CreateIndex
CREATE INDEX "teacher_sections_teacherId_idx" ON "teacher_sections"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_sections_classId_idx" ON "teacher_sections"("classId");

-- CreateIndex
CREATE INDEX "teacher_sections_sectionId_idx" ON "teacher_sections"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_sections_teacherId_classId_sectionId_key" ON "teacher_sections"("teacherId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "exams_schoolId_idx" ON "exams"("schoolId");

-- CreateIndex
CREATE INDEX "exams_schoolId_academicYear_idx" ON "exams"("schoolId", "academicYear");

-- CreateIndex
CREATE INDEX "exam_subjects_examId_idx" ON "exam_subjects"("examId");

-- CreateIndex
CREATE INDEX "exam_subjects_classId_idx" ON "exam_subjects"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_subjects_examId_classId_subjectName_key" ON "exam_subjects"("examId", "classId", "subjectName");

-- CreateIndex
CREATE INDEX "exam_marks_studentId_idx" ON "exam_marks"("studentId");

-- CreateIndex
CREATE INDEX "exam_marks_examSubjectId_idx" ON "exam_marks"("examSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_marks_examSubjectId_studentId_key" ON "exam_marks"("examSubjectId", "studentId");

-- CreateIndex
CREATE INDEX "timetable_periods_schoolId_idx" ON "timetable_periods"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_periods_schoolId_startTime_key" ON "timetable_periods"("schoolId", "startTime");

-- CreateIndex
CREATE INDEX "timetable_slots_schoolId_teacherId_dayOfWeek_startTime_idx" ON "timetable_slots"("schoolId", "teacherId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "timetable_slots_schoolId_classId_sectionId_idx" ON "timetable_slots"("schoolId", "classId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_slots_schoolId_sectionId_dayOfWeek_startTime_key" ON "timetable_slots"("schoolId", "sectionId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "salary_slips_schoolId_year_month_idx" ON "salary_slips"("schoolId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "salary_slips_teacherId_year_month_key" ON "salary_slips"("teacherId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "salary_slips_schoolId_slipNumber_key" ON "salary_slips"("schoolId", "slipNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payouts_transactionId_key" ON "payroll_payouts"("transactionId");

-- CreateIndex
CREATE INDEX "payroll_payouts_schoolId_idx" ON "payroll_payouts"("schoolId");

-- CreateIndex
CREATE INDEX "payroll_payouts_salarySlipId_idx" ON "payroll_payouts"("salarySlipId");

-- CreateIndex
CREATE INDEX "attendances_schoolId_classId_date_status_idx" ON "attendances"("schoolId", "classId", "date", "status");

-- CreateIndex
CREATE INDEX "classes_classTeacherId_idx" ON "classes"("classTeacherId");

-- CreateIndex
CREATE INDEX "expenses_schoolId_date_idx" ON "expenses"("schoolId", "date");

-- CreateIndex
CREATE INDEX "fee_charge_items_chargeId_status_idx" ON "fee_charge_items"("chargeId", "status");

-- CreateIndex
CREATE INDEX "fee_charge_items_componentId_status_idx" ON "fee_charge_items"("componentId", "status");

-- CreateIndex
CREATE INDEX "fee_charges_schoolId_status_dueDate_idx" ON "fee_charges"("schoolId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "fee_charges_studentId_schoolId_status_idx" ON "fee_charges"("studentId", "schoolId", "status");

-- CreateIndex
CREATE INDEX "payment_transactions_schoolId_date_idx" ON "payment_transactions"("schoolId", "date");

-- CreateIndex
CREATE INDEX "payment_transactions_studentId_date_idx" ON "payment_transactions"("studentId", "date");

-- CreateIndex
CREATE INDEX "student_transports_schoolId_status_idx" ON "student_transports"("schoolId", "status");

-- CreateIndex
CREATE INDEX "students_schoolId_isActive_classId_idx" ON "students"("schoolId", "isActive", "classId");

-- CreateIndex
CREATE INDEX "students_schoolId_isActive_name_idx" ON "students"("schoolId", "isActive", "name");

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_sections" ADD CONSTRAINT "teacher_sections_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_sections" ADD CONSTRAINT "teacher_sections_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_sections" ADD CONSTRAINT "teacher_sections_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_sections" ADD CONSTRAINT "teacher_sections_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES "exam_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "timetable_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payouts" ADD CONSTRAINT "payroll_payouts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_payouts" ADD CONSTRAINT "payroll_payouts_salarySlipId_fkey" FOREIGN KEY ("salarySlipId") REFERENCES "salary_slips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

