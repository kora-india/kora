import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { prisma, purgeSchool } from "@schoolos/db";
import { auth } from "@schoolos/auth";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// Cloudinary's network calls are faked; its signing code is the real one.
const cloud = vi.hoisted(() => ({ resource: vi.fn(), destroy: vi.fn() }));
vi.mock("cloudinary", async (importOriginal) => {
  const real = await importOriginal<typeof import("cloudinary")>();
  real.v2.api.resource = cloud.resource as any;
  real.v2.uploader.destroy = cloud.destroy as any;
  return real;
});

import { v2 as cloudinary } from "cloudinary";
import {
  deleteDocument,
  finishDocumentUpload,
  getDocumentLink,
  getEmployeeRecords,
  saveEmployeeDetails,
  startDocumentUpload,
} from "../employee-records";
import { verhoeffValid } from "@/lib/employee-details";

const run = Math.random().toString(36).slice(2, 8);
const schoolId = `emp-school-${run}`;
const otherSchoolId = `emp-other-${run}`;
const SECRET = "test-cloudinary-secret";

const aadhaar = (() => {
  const base = "28765432109";
  const d = [..."0123456789"].find((x) => verhoeffValid(base + x))!;
  return base + d;
})();

const signInAs = (id: string, role: string, school = schoolId) =>
  vi.mocked(auth).mockResolvedValue({
    user: { id, schoolId: school, role, name: "Asha Admin" },
  } as any);

describe("teacher and staff records", () => {
  let adminId: string;
  let teacherUserId: string;
  let teacherId: string;
  let staffId: string;
  let otherTeacherId: string;
  const asTeacher = () => ({ type: "teacher", id: teacherId });

  beforeAll(async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "123456");
    vi.stubEnv("CLOUDINARY_API_SECRET", SECRET);
    vi.stubEnv(
      "DATA_ENCRYPTION_KEY",
      "employee-records-test-key-32-characters",
    );
    for (const id of [schoolId, otherSchoolId]) {
      await prisma.school.create({
        data: { id, name: id, subdomain: id, plan: "PRO" },
      });
    }
    const user = (role: string, school: string, who: string) =>
      prisma.user.create({
        data: {
          email: `${who}-${run}@emp.test`,
          name: who,
          password: "x",
          role: role as any,
          schoolId: school,
        },
      });
    adminId = (await user("SCHOOL_ADMIN", schoolId, "admin")).id;
    teacherUserId = (await user("TEACHER", schoolId, "teacher")).id;
    teacherId = (
      await prisma.teacher.create({
        data: {
          schoolId,
          userId: teacherUserId,
          name: "Meera Rao",
          email: "m@x.test",
          subject: "Maths",
        },
      })
    ).id;
    staffId = (
      await prisma.staff.create({
        data: {
          schoolId,
          name: "Ramesh",
          phone: "9000000000",
          occupation: "Driver",
        },
      })
    ).id;
    const otherUser = await user("TEACHER", otherSchoolId, "other");
    otherTeacherId = (
      await prisma.teacher.create({
        data: {
          schoolId: otherSchoolId,
          userId: otherUser.id,
          name: "Other",
          email: "o@x.test",
          subject: "Art",
        },
      })
    ).id;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    for (const id of [schoolId, otherSchoolId]) {
      await prisma.activityLog.deleteMany({ where: { schoolId: id } });
      const users = await prisma.user.findMany({
        where: { schoolId: id },
        select: { id: true },
      });
      await purgeSchool(prisma, id);
      await prisma.user.deleteMany({
        where: { id: { in: users.map((u) => u.id) } },
      });
    }
  });

  beforeEach(() => {
    signInAs(adminId, "SCHOOL_ADMIN");
    cloud.resource.mockReset();
    cloud.destroy.mockReset().mockResolvedValue({ result: "ok" });
  });

  describe("ID and bank details", () => {
    it("saves them, encrypting the Aadhaar and account numbers", async () => {
      const res = await saveEmployeeDetails(asTeacher(), {
        aadhaarNumber: aadhaar,
        panNumber: "abcde1234f",
        bankAccountHolder: "Meera Rao",
        bankName: "State Bank of India",
        bankAccountNumber: "001234567890",
        bankIfsc: "sbin0001234",
        upiId: "meera@okaxis",
        uanNumber: "100123456789",
      });
      expect(res).toMatchObject({
        success: true,
        details: {
          aadhaarNumber: aadhaar,
          bankAccountNumber: "001234567890",
          panNumber: "ABCDE1234F",
          bankIfsc: "SBIN0001234",
        },
      });

      const row = await prisma.employeeDetails.findUniqueOrThrow({
        where: { teacherId },
      });
      expect(JSON.stringify(row)).not.toContain(aadhaar);
      expect(JSON.stringify(row)).not.toContain("001234567890");
      expect(row).toMatchObject({
        aadhaarLast4: aadhaar.slice(-4),
        bankAccountLast4: "7890",
        schoolId,
      });

      const records = await getEmployeeRecords(asTeacher());
      expect(records).toMatchObject({
        details: { aadhaarNumber: aadhaar, bankAccountNumber: "001234567890" },
      });
    });

    it("logs which details changed, never their values", async () => {
      await saveEmployeeDetails(asTeacher(), {
        aadhaarNumber: aadhaar,
        upiId: "meera@okhdfc",
      });
      const log = await prisma.activityLog.findFirstOrThrow({
        where: { schoolId, action: "staff.details" },
        orderBy: { createdAt: "desc" },
      });
      expect(log.details).toMatchObject({
        changed: expect.arrayContaining(["upiId"]),
      });
      expect(JSON.stringify(log)).not.toContain(aadhaar);
    });

    it("clears a field left blank, and refuses a wrong number", async () => {
      expect(
        await saveEmployeeDetails(asTeacher(), { aadhaarNumber: "" }),
      ).toMatchObject({
        details: { aadhaarNumber: null },
      });
      const row = await prisma.employeeDetails.findUniqueOrThrow({
        where: { teacherId },
      });
      expect(row.aadhaarEncrypted).toBeNull();
      expect(
        await saveEmployeeDetails(asTeacher(), { bankIfsc: "SBIN" }),
      ).toEqual({
        error: "IFSC must look like SBIN0001234",
      });
    });

    it("works for staff members too", async () => {
      const res = await saveEmployeeDetails(
        { type: "staff", id: staffId },
        { panNumber: "PQRST6789K" },
      );
      expect(res).toMatchObject({ success: true });
      expect(
        await prisma.employeeDetails.findUnique({ where: { staffId } }),
      ).toMatchObject({ panNumber: "PQRST6789K" });
    });

    it("is only for people who can manage staff", async () => {
      signInAs(teacherUserId, "TEACHER");
      expect(await getEmployeeRecords(asTeacher())).toEqual({
        error: "Unauthorized",
      });
      expect(
        await saveEmployeeDetails(asTeacher(), { panNumber: "ABCDE1234F" }),
      ).toEqual({ error: "Unauthorized" });
    });

    it("never reaches another school's teacher", async () => {
      expect(
        await getEmployeeRecords({ type: "teacher", id: otherTeacherId }),
      ).toEqual({
        error: "That person isn't in your school",
      });
      expect(
        await saveEmployeeDetails(
          { type: "teacher", id: otherTeacherId },
          { panNumber: "ABCDE1234F" },
        ),
      ).toEqual({
        error: "That person isn't in your school",
      });
      // A teacher id passed as a staff member is no one either.
      expect(
        await getEmployeeRecords({ type: "staff", id: teacherId }),
      ).toEqual({
        error: "That person isn't in your school",
      });
    });
  });

  describe("documents", () => {
    const file = {
      kind: "MARKSHEET",
      title: "Class 12",
      fileName: "marks.pdf",
      size: 200_000,
      type: "application/pdf",
    };

    async function upload(over: Partial<typeof file> = {}) {
      const start = await startDocumentUpload(asTeacher(), {
        ...file,
        ...over,
      });
      if ("error" in start) throw new Error(start.error);
      return start;
    }

    it("hands out a signature for one private file in the school's folder", async () => {
      const start = await upload();
      expect(start.uploadUrl).toBe(
        "https://api.cloudinary.com/v1_1/demo-cloud/image/upload",
      );
      const { signature, api_key, ...signed } = start.fields;
      expect(api_key).toBe("123456");
      expect(signed).toMatchObject({
        type: "private",
        overwrite: "false",
        allowed_formats: "pdf,jpg,jpeg,png,webp",
        public_id: expect.stringMatching(
          new RegExp(`^kora_documents/${schoolId}/[0-9a-f-]{36}$`),
        ),
      });
      // Cloudinary checks this signature against exactly these fields.
      expect(signature).toBe(cloudinary.utils.api_sign_request(signed, SECRET));
      const doc = await prisma.employeeDocument.findUniqueOrThrow({
        where: { id: start.documentId },
      });
      expect(doc).toMatchObject({
        status: "PENDING",
        teacherId,
        kind: "MARKSHEET",
        title: "Class 12",
      });
      // Not listed until it's checked.
      const records = await getEmployeeRecords(asTeacher());
      expect(
        "documents" in records && records.documents.map((d) => d.id),
      ).not.toContain(start.documentId);
    });

    it("refuses other files before anything is uploaded", async () => {
      for (const [over, message] of [
        [
          { type: "text/html", fileName: "x.html" },
          "Use a PDF, JPG, PNG or WebP file.",
        ],
        [{ size: 11 * 1024 * 1024 }, "A document can be up to 10 MB."],
        [{ kind: "PASSPORT" }, "Choose the file again."],
        [{ title: "x".repeat(81) }, "Keep the name under 80 characters"],
      ] as const) {
        expect(
          await startDocumentUpload(asTeacher(), { ...file, ...over }),
        ).toEqual({ error: message });
      }
    });

    it("keeps the file once Cloudinary has it as a private PDF or image", async () => {
      const start = await upload();
      cloud.resource.mockResolvedValue({
        format: "pdf",
        bytes: 200_123,
        type: "private",
      });
      const done = await finishDocumentUpload(start.documentId);
      expect(done).toMatchObject({
        success: true,
        document: { format: "pdf", bytes: 200_123, title: "Class 12" },
      });
      expect(cloud.resource).toHaveBeenCalledWith(start.fields.public_id, {
        type: "private",
        resource_type: "image",
      });
      const records = await getEmployeeRecords(asTeacher());
      expect("documents" in records && records.documents[0].id).toBe(
        start.documentId,
      );
    });

    it("throws away an upload that didn't arrive or isn't a document", async () => {
      for (const [answer, message] of [
        [
          () => Promise.reject(new Error("Resource not found")),
          "The file didn't reach us. Try uploading it again.",
        ],
        [
          () => Promise.resolve({ format: "gif", bytes: 10, type: "private" }),
          "Use a PDF, JPG, PNG or WebP file.",
        ],
        [
          () => Promise.resolve({ format: "pdf", bytes: 10, type: "upload" }),
          "Use a PDF, JPG, PNG or WebP file.",
        ],
        [
          () =>
            Promise.resolve({
              format: "png",
              bytes: 11 * 1024 * 1024,
              type: "private",
            }),
          "A document can be up to 10 MB.",
        ],
      ] as const) {
        const start = await upload();
        cloud.resource.mockImplementationOnce(answer as () => Promise<unknown>);
        expect(await finishDocumentUpload(start.documentId)).toEqual({
          error: message,
        });
        expect(
          await prisma.employeeDocument.findUnique({
            where: { id: start.documentId },
          }),
        ).toBeNull();
      }
      expect(cloud.destroy).toHaveBeenCalledWith(
        expect.stringMatching(/^kora_documents\//),
        {
          type: "private",
          resource_type: "image",
        },
      );
    });

    it("opens a document through a link that expires", async () => {
      const start = await upload();
      cloud.resource.mockResolvedValue({
        format: "pdf",
        bytes: 1000,
        type: "private",
      });
      await finishDocumentUpload(start.documentId);
      const before = Math.floor(Date.now() / 1000);
      const res = await getDocumentLink(start.documentId);
      if ("error" in res) throw new Error(res.error);
      const url = new URL(res.url);
      expect(url.host).toBe("api.cloudinary.com");
      expect(url.searchParams.get("type")).toBe("private");
      const expires = Number(url.searchParams.get("expires_at"));
      expect(expires).toBeGreaterThan(before);
      expect(expires).toBeLessThanOrEqual(before + 5 * 60 + 1);
      expect(
        await prisma.activityLog.count({
          where: {
            schoolId,
            action: "document.view",
            entityId: start.documentId,
          },
        }),
      ).toBe(1);
    });

    it("won't open a document that isn't finished", async () => {
      const start = await upload();
      expect(await getDocumentLink(start.documentId)).toEqual({
        error: "That document isn't in your school",
      });
    });

    it("deletes the file and the record, and keeps both if Cloudinary fails", async () => {
      const start = await upload();
      cloud.resource.mockResolvedValue({
        format: "png",
        bytes: 1000,
        type: "private",
      });
      await finishDocumentUpload(start.documentId);

      cloud.destroy.mockResolvedValueOnce({ result: "error" });
      expect(await deleteDocument(start.documentId)).toEqual({
        error: "Couldn't delete the file. Try again.",
      });
      expect(
        await prisma.employeeDocument.findUnique({
          where: { id: start.documentId },
        }),
      ).not.toBeNull();

      expect(await deleteDocument(start.documentId)).toEqual({ success: true });
      expect(
        await prisma.employeeDocument.findUnique({
          where: { id: start.documentId },
        }),
      ).toBeNull();
      expect(cloud.destroy).toHaveBeenLastCalledWith(start.fields.public_id, {
        type: "private",
        resource_type: "image",
        invalidate: true,
      });
    });

    it("clears away uploads left unfinished for an hour", async () => {
      const stale = await upload();
      await prisma.employeeDocument.update({
        where: { id: stale.documentId },
        data: { createdAt: new Date(Date.now() - 2 * 60 * 60_000) },
      });
      await upload();
      expect(
        await prisma.employeeDocument.findUnique({
          where: { id: stale.documentId },
        }),
      ).toBeNull();
      expect(cloud.destroy).toHaveBeenCalledWith(
        stale.fields.public_id,
        expect.anything(),
      );
    });

    it("keeps documents to the school and to staff managers", async () => {
      const start = await upload();
      cloud.resource.mockResolvedValue({
        format: "pdf",
        bytes: 1000,
        type: "private",
      });
      await finishDocumentUpload(start.documentId);

      signInAs(teacherUserId, "TEACHER");
      for (const result of [
        await getDocumentLink(start.documentId),
        await deleteDocument(start.documentId),
        await finishDocumentUpload(start.documentId),
        await startDocumentUpload(asTeacher(), file),
      ]) {
        expect(result).toEqual({ error: "Unauthorized" });
      }

      const otherAdmin = await prisma.user.create({
        data: {
          email: `oa-${run}@emp.test`,
          name: "Other admin",
          password: "x",
          role: "SCHOOL_ADMIN",
          schoolId: otherSchoolId,
        },
      });
      signInAs(otherAdmin.id, "SCHOOL_ADMIN", otherSchoolId);
      expect(await getDocumentLink(start.documentId)).toEqual({
        error: "That document isn't in your school",
      });
      expect(await deleteDocument(start.documentId)).toEqual({
        error: "That document isn't in your school",
      });
      expect(await startDocumentUpload(asTeacher(), file)).toEqual({
        error: "That person isn't in your school",
      });
    });

    it("says so when uploads aren't set up", async () => {
      vi.stubEnv("CLOUDINARY_API_SECRET", "");
      expect(await startDocumentUpload(asTeacher(), file)).toEqual({
        error: "File uploads aren't set up on this server yet.",
      });
      expect(await getEmployeeRecords(asTeacher())).toMatchObject({
        uploadsReady: false,
      });
      vi.stubEnv("CLOUDINARY_API_SECRET", SECRET);
    });
  });
});
