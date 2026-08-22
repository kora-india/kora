import { z } from "zod";

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

try {
  importStudentSchema.parse({
    classId: "LKG",
    sectionId: "C",
    name: "Rudra Sharma",
    parentName: "Kavya Tiwari",
    parentPhone: "9193349856",
    admissionNumber: "ADM20260001",
    rollNumber: "35",
    dateOfBirth: "2011-04-05",
    gender: "FEMALE"
  });
  console.log("Success");
} catch (e: any) {
  const errMsgs = e.errors ? e.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ') : 'Invalid data';
  console.log("Error:", errMsgs);
}
