"use server";

import { z } from "zod";
import { prisma } from "@schoolos/db";
import { auth } from "@schoolos/auth";
import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/redis";

const importStudentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  parentName: z.string().min(1, "Parent Name is required"),
  parentPhone: z.string().min(1, "Parent Phone is required"),
  admissionNumber: z.string().nullish(),
  rollNumber: z.string().nullish(),
  dateOfBirth: z.string().nullish(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullish().default("MALE"),
});

export async function bulkImportStudents(data: any[]) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  
  const schoolId = session.user.schoolId;

  // 1. Validation
  const validRecords: z.infer<typeof importStudentSchema>[] = [];
  const errors: string[] = [];

  data.forEach((row, index) => {
    try {
      const parsed = importStudentSchema.parse(row);
      validRecords.push(parsed);
    } catch (e: any) {
      const errMsgs = e.errors ? e.errors.map((err: any) => `${err.path.length > 0 ? err.path.join('.') + ': ' : ''}${err.message}`).join(' | ') : 'Invalid data';
      errors.push(`Row ${index + 1} [v2]: ${errMsgs}`);
    }
  });

  if (validRecords.length === 0) {
    return { imported: 0, skipped: 0, failed: data.length, errors: [...errors, "No valid records to import"] };
  }

  // 2. Resolve or Create Classes and Sections
  const existingClasses = await prisma.class.findMany({
    where: { schoolId },
    include: { sections: true }
  });

  const classMap = new Map<string, any>();
  for (const c of existingClasses) {
    classMap.set(c.id, c);
    classMap.set(c.name.toLowerCase(), c);
    classMap.set(`class ${c.name.toLowerCase()}`, c);
    classMap.set(`grade ${c.name.toLowerCase()}`, c);
  }

  // Pre-process validRecords to resolve classId and sectionId
  for (const record of validRecords) {
    let classObj = classMap.get(record.classId) || classMap.get(record.classId.toLowerCase());
    if (!classObj) {
      // Auto-create class
      const newClass = await prisma.class.create({
        data: {
          schoolId,
          name: record.classId,
          grade: parseInt(record.classId.replace(/\D/g, '')) || 1, // best effort grade extraction
        },
        include: { sections: true }
      });
      classObj = newClass;
      classMap.set(newClass.id, newClass);
      classMap.set(newClass.name.toLowerCase(), newClass);
    }
    
    // Update record with actual ID
    record.classId = classObj.id;

    let sectionObj = classObj.sections.find((s: any) => s.id === record.sectionId || s.name.toLowerCase() === record.sectionId.toLowerCase());
    if (!sectionObj) {
      // Auto-create section
      sectionObj = await prisma.section.create({
        data: {
          schoolId,
          classId: classObj.id,
          name: record.sectionId,
        }
      });
      classObj.sections.push(sectionObj);
    }

    // Update record with actual ID
    record.sectionId = sectionObj.id;
  }

  // 3. Duplicate Check for Admission Numbers
  const providedAdmissionNumbers = validRecords.map(r => r.admissionNumber).filter(Boolean) as string[];
  const existingStudents = await prisma.student.findMany({
    where: { 
      schoolId,
      admissionNumber: { in: providedAdmissionNumbers }
    },
    select: { admissionNumber: true }
  });
  const existingSet = new Set(existingStudents.map(s => s.admissionNumber));

  // 4. Process records
  const toImport: any[] = [];
  let skippedCount = 0;
  
  // Track roll numbers per section to auto-generate if missing
  const maxRollPerSection: Record<string, number> = {};
  const currentStudents = await prisma.student.findMany({
    where: { schoolId },
    select: { sectionId: true, rollNumber: true }
  });
  
  for (const s of currentStudents) {
    if (!maxRollPerSection[s.sectionId]) maxRollPerSection[s.sectionId] = 0;
    const rNum = parseInt(s.rollNumber, 10);
    if (!isNaN(rNum) && rNum > maxRollPerSection[s.sectionId]) {
      maxRollPerSection[s.sectionId] = rNum;
    }
  }

  for (const record of validRecords) {
    // Skip if admission number exists
    if (record.admissionNumber && existingSet.has(record.admissionNumber)) {
      skippedCount++;
      errors.push(`Skipped: Admission No ${record.admissionNumber} already exists.`);
      continue;
    }

    // Auto-generate admission number if missing
    let admNo = record.admissionNumber;
    if (!admNo) {
      // Generate a simple unique string: ADM-timestamp-random
      admNo = `ADM-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`;
    }

    // Auto-generate roll number if missing
    let rollNo = record.rollNumber;
    if (!rollNo) {
      if (!maxRollPerSection[record.sectionId]) maxRollPerSection[record.sectionId] = 0;
      maxRollPerSection[record.sectionId]++;
      rollNo = maxRollPerSection[record.sectionId].toString();
    } else {
      // If provided, parse it to update the max roll tracker
      const rNum = parseInt(rollNo, 10);
      if (!isNaN(rNum)) {
        if (!maxRollPerSection[record.sectionId] || rNum > maxRollPerSection[record.sectionId]) {
          maxRollPerSection[record.sectionId] = rNum;
        }
      }
    }

    // Parse date if string
    let dob: Date | null = null;
    if (record.dateOfBirth) {
      const d = new Date(record.dateOfBirth);
      if (!isNaN(d.getTime())) dob = d;
    }

    toImport.push({
      schoolId,
      classId: record.classId,
      sectionId: record.sectionId,
      name: record.name,
      parentName: record.parentName,
      parentPhone: String(record.parentPhone),
      admissionNumber: admNo,
      rollNumber: rollNo,
      dateOfBirth: dob,
      gender: record.gender,
      isActive: true,
    });
  }

  if (toImport.length === 0) {
    return { imported: 0, skipped: skippedCount, failed: data.length - skippedCount, errors };
  }

  // 5. Bulk Insert

  try {
    const result = await prisma.student.createMany({
      data: toImport,
      skipDuplicates: true, 
    });

    // Invalidate Redis caches
    await invalidateCache(`cache:${schoolId}:students:*`);
    await invalidateCache(`cache:${schoolId}:classes:*`);
    await invalidateCache(`cache:${schoolId}:dashboard`);

    revalidatePath("/students");
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    
    return {
      imported: result.count,
      skipped: skippedCount,
      failed: data.length - result.count - skippedCount,
      errors
    };
  } catch (error: any) {
    throw new Error(`Database error during import: ${error.message}`);
  }
}
