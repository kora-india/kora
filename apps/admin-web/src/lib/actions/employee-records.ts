"use server";

import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@schoolos/db";
import { isError, requirePermission } from "@/lib/auth-guard";
import { actionErrorMessage } from "@/lib/action-errors";
import { logActivity } from "@/lib/activity";
import { getCloudinary, UPLOADS_NOT_SET_UP } from "@/lib/cloudinary";
import { decryptField, encryptField } from "@/lib/field-crypto";
import {
  DOCUMENT_FORMATS,
  DOCUMENT_KIND_KEYS,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_TYPES,
  EMPTY_DETAILS,
  EmployeeDetailsSchema,
  documentFileProblem,
  documentLabel,
  type DocumentKind,
  type EmployeeDetails,
  type EmployeeDocumentRecord,
} from "@/lib/employee-details";

/**
 * A teacher's or staff member's ID and bank details and their documents.
 * Everything here needs Staff: manage, and only ever reaches the school's
 * own teachers and staff. Documents are private Cloudinary files: the
 * browser uploads straight to Cloudinary with a signature for one file name,
 * the server checks what arrived, and files open only through links that
 * expire after a few minutes.
 */

const OwnerSchema = z.object({
  type: z.enum(["teacher", "staff"]),
  id: z.string().min(1),
});
type Owner = z.infer<typeof OwnerSchema>;

const LINK_MINUTES = 5;
/** An upload that hasn't finished in this long is given up on. */
const PENDING_MINUTES = 60;
const NOT_FOUND = "That person isn't in your school";
const DOCUMENT_NOT_FOUND = "That document isn't in your school";

async function getAccess() {
  const access = await requirePermission("staff", "manage");
  return isError(access) ? null : { ...access, schoolId: access.schoolId! };
}
type Access = NonNullable<Awaited<ReturnType<typeof getAccess>>>;

const ownerColumn = (owner: Owner) =>
  owner.type === "teacher" ? { teacherId: owner.id } : { staffId: owner.id };

/** The teacher or staff member, if they're this school's. */
async function findOwner(schoolId: string, owner: Owner) {
  const where = { id: owner.id, schoolId };
  const select = { id: true, name: true };
  return owner.type === "teacher"
    ? prisma.teacher.findFirst({ where, select })
    : prisma.staff.findFirst({ where, select });
}

type Resolved =
  | { error: string }
  | { user: Access; owner: Owner; person: { id: string; name: string } };

async function resolve(raw: unknown): Promise<Resolved> {
  const user = await getAccess();
  if (!user) return { error: "Unauthorized" };
  const parsed = OwnerSchema.safeParse(raw);
  if (!parsed.success) return { error: NOT_FOUND };
  const person = await findOwner(user.schoolId, parsed.data);
  if (!person) return { error: NOT_FOUND };
  return { user, owner: parsed.data, person };
}

type DetailsRow = Awaited<ReturnType<typeof prisma.employeeDetails.findFirst>>;

function toDetails(row: DetailsRow): EmployeeDetails {
  if (!row) return EMPTY_DETAILS;
  return {
    aadhaarNumber: decryptField(row.aadhaarEncrypted),
    panNumber: row.panNumber,
    uanNumber: row.uanNumber,
    bankAccountHolder: row.bankAccountHolder,
    bankName: row.bankName,
    bankAccountNumber: decryptField(row.bankAccountEncrypted),
    bankIfsc: row.bankIfsc,
    upiId: row.upiId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

type DocumentRow = NonNullable<
  Awaited<ReturnType<typeof prisma.employeeDocument.findFirst>>
>;

const toDocument = (row: DocumentRow): EmployeeDocumentRecord => ({
  id: row.id,
  kind: row.kind as DocumentKind,
  title: row.title,
  fileName: row.fileName,
  format: row.format,
  bytes: row.bytes,
  uploadedByName: row.uploadedByName,
  createdAt: row.createdAt.toISOString(),
});

/** Their details (numbers in full, for Staff: manage) and documents. */
export async function getEmployeeRecords(owner: unknown): Promise<
  | {
      details: EmployeeDetails;
      documents: EmployeeDocumentRecord[];
      uploadsReady: boolean;
    }
  | { error: string }
> {
  const ctx = await resolve(owner);
  if ("error" in ctx) return { error: ctx.error };
  const { user } = ctx;
  const [details, documents] = await Promise.all([
    prisma.employeeDetails.findFirst({
      where: { schoolId: user.schoolId, ...ownerColumn(ctx.owner) },
    }),
    prisma.employeeDocument.findMany({
      where: {
        schoolId: user.schoolId,
        ...ownerColumn(ctx.owner),
        status: "READY",
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    details: toDetails(details),
    documents: documents.map(toDocument),
    uploadsReady: getCloudinary() !== null,
  };
}

/** Saves their ID and bank details; blank fields are cleared. */
export async function saveEmployeeDetails(
  owner: unknown,
  input: unknown,
): Promise<{ success: true; details: EmployeeDetails } | { error: string }> {
  const ctx = await resolve(owner);
  if ("error" in ctx) return { error: ctx.error };
  const { user, person } = ctx;

  const parsed = EmployeeDetailsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;

  try {
    const data = {
      panNumber: d.panNumber,
      aadhaarEncrypted: d.aadhaarNumber ? encryptField(d.aadhaarNumber) : null,
      aadhaarLast4: d.aadhaarNumber ? d.aadhaarNumber.slice(-4) : null,
      uanNumber: d.uanNumber,
      bankAccountHolder: d.bankAccountHolder,
      bankName: d.bankName,
      bankAccountEncrypted: d.bankAccountNumber
        ? encryptField(d.bankAccountNumber)
        : null,
      bankAccountLast4: d.bankAccountNumber
        ? d.bankAccountNumber.slice(-4)
        : null,
      bankIfsc: d.bankIfsc,
      upiId: d.upiId,
      updatedById: user.id,
    };
    const where = ownerColumn(ctx.owner);
    const before = await prisma.employeeDetails.findFirst({
      where: { schoolId: user.schoolId, ...where },
    });
    const saved = before
      ? await prisma.employeeDetails.update({ where: { id: before.id }, data })
      : await prisma.employeeDetails.create({
          data: { ...data, ...where, schoolId: user.schoolId },
        });

    // Which fields changed, never their values.
    const old = toDetails(before);
    const now = toDetails(saved);
    const changed = (Object.keys(EMPTY_DETAILS) as (keyof EmployeeDetails)[])
      .filter((key) => key !== "updatedAt")
      .filter((key) => (old[key] ?? null) !== (now[key] ?? null));
    if (changed.length > 0) {
      await logActivity(user, {
        action: "staff.details",
        module: "staff",
        summary: `Updated ID and bank details for ${person.name}`,
        entityType: ctx.owner.type === "teacher" ? "Teacher" : "Staff",
        entityId: person.id,
        details: { changed },
      });
    }
    return { success: true, details: now };
  } catch (e) {
    return { error: actionErrorMessage(e, "Couldn't save the details") };
  }
}

const StartSchema = z.object({
  kind: z.enum(DOCUMENT_KIND_KEYS),
  title: z
    .string()
    .trim()
    .max(80, "Keep the name under 80 characters")
    .optional(),
  fileName: z.string().trim().min(1).max(200),
  size: z.number().int().positive().max(DOCUMENT_MAX_BYTES),
  type: z.string().refine((t) => Boolean(DOCUMENT_TYPES[t])),
});

/** Throws away uploads of this person's that never finished. */
async function dropStaleUploads(user: Access, owner: Owner) {
  const cloud = getCloudinary();
  const stale = await prisma.employeeDocument.findMany({
    where: {
      schoolId: user.schoolId,
      ...ownerColumn(owner),
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - PENDING_MINUTES * 60_000) },
    },
    select: { id: true, publicId: true },
  });
  for (const doc of stale) {
    await cloud?.cloudinary.uploader
      .destroy(doc.publicId, { type: "private", resource_type: "image" })
      .catch(() => null);
    await prisma.employeeDocument.delete({ where: { id: doc.id } });
  }
}

/**
 * Starts an upload: records the document and returns what the browser sends
 * to Cloudinary with the file. The signature is for this one file name, as
 * a private upload of a PDF or an image; Cloudinary refuses anything else.
 */
export async function startDocumentUpload(
  owner: unknown,
  input: unknown,
): Promise<
  | {
      documentId: string;
      uploadUrl: string;
      fields: Record<string, string>;
    }
  | { error: string }
> {
  const ctx = await resolve(owner);
  if ("error" in ctx) return { error: ctx.error };
  const { user } = ctx;
  const cloud = getCloudinary();
  if (!cloud) return { error: UPLOADS_NOT_SET_UP };

  const parsed = StartSchema.safeParse(input);
  if (!parsed.success) {
    const title = parsed.error.errors.find((e) => e.path[0] === "title");
    if (title) return { error: title.message };
    const raw = (input ?? {}) as { type?: unknown; size?: unknown };
    return {
      error:
        documentFileProblem({
          type: String(raw.type ?? ""),
          size: Number(raw.size ?? 0),
        }) ?? "Choose the file again.",
    };
  }

  try {
    await dropStaleUploads(user, ctx.owner);
    const publicId = `kora_documents/${user.schoolId}/${crypto.randomUUID()}`;
    const doc = await prisma.employeeDocument.create({
      data: {
        schoolId: user.schoolId,
        ...ownerColumn(ctx.owner),
        kind: parsed.data.kind,
        title: parsed.data.title || null,
        fileName: parsed.data.fileName,
        publicId,
        uploadedById: user.id,
        uploadedByName: user.name || "Unknown",
      },
    });
    const params = {
      allowed_formats: DOCUMENT_FORMATS.join(","),
      overwrite: "false",
      public_id: publicId,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: "private",
    };
    const signature = cloud.cloudinary.utils.api_sign_request(
      params,
      cloud.apiSecret,
    );
    return {
      documentId: doc.id,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloud.cloudName}/image/upload`,
      fields: { ...params, api_key: cloud.apiKey, signature },
    };
  } catch (e) {
    return { error: actionErrorMessage(e, "Couldn't start the upload") };
  }
}

/**
 * Finishes an upload once the browser has sent the file: checks with
 * Cloudinary what actually arrived, then keeps it, or deletes it.
 */
export async function finishDocumentUpload(
  documentId: string,
): Promise<
  { success: true; document: EmployeeDocumentRecord } | { error: string }
> {
  const user = await getAccess();
  if (!user) return { error: "Unauthorized" };
  const cloud = getCloudinary();
  if (!cloud) return { error: UPLOADS_NOT_SET_UP };

  const doc = await prisma.employeeDocument.findFirst({
    where: { id: String(documentId), schoolId: user.schoolId },
    include: {
      teacher: { select: { name: true } },
      staff: { select: { name: true } },
    },
  });
  if (!doc) return { error: DOCUMENT_NOT_FOUND };
  if (doc.status === "READY")
    return { success: true, document: toDocument(doc) };

  const discard = async (message: string) => {
    await cloud.cloudinary.uploader
      .destroy(doc.publicId, { type: "private", resource_type: "image" })
      .catch(() => null);
    await prisma.employeeDocument.delete({ where: { id: doc.id } });
    return { error: message };
  };

  let resource: { format?: string; bytes?: number; type?: string };
  try {
    resource = await cloud.cloudinary.api.resource(doc.publicId, {
      type: "private",
      resource_type: "image",
    });
  } catch {
    return discard("The file didn't reach us. Try uploading it again.");
  }
  const format = String(resource.format ?? "").toLowerCase();
  if (resource.type !== "private" || !DOCUMENT_FORMATS.includes(format)) {
    return discard("Use a PDF, JPG, PNG or WebP file.");
  }
  if (!resource.bytes || resource.bytes > DOCUMENT_MAX_BYTES) {
    return discard("A document can be up to 10 MB.");
  }

  const ready = await prisma.employeeDocument.update({
    where: { id: doc.id },
    data: { status: "READY", format, bytes: resource.bytes },
  });
  const name = doc.teacher?.name ?? doc.staff?.name ?? "someone";
  await logActivity(user, {
    action: "document.upload",
    module: "staff",
    summary: `Added ${documentLabel(doc)} for ${name}`,
    entityType: "EmployeeDocument",
    entityId: doc.id,
  });
  return { success: true, document: toDocument(ready) };
}

/** A link that opens the document for the next few minutes. */
export async function getDocumentLink(
  documentId: string,
): Promise<{ url: string } | { error: string }> {
  const user = await getAccess();
  if (!user) return { error: "Unauthorized" };
  const cloud = getCloudinary();
  if (!cloud) return { error: UPLOADS_NOT_SET_UP };

  const doc = await prisma.employeeDocument.findFirst({
    where: { id: String(documentId), schoolId: user.schoolId, status: "READY" },
    include: {
      teacher: { select: { name: true } },
      staff: { select: { name: true } },
    },
  });
  if (!doc) return { error: DOCUMENT_NOT_FOUND };

  const url = cloud.cloudinary.utils.private_download_url(
    doc.publicId,
    doc.format ?? "pdf",
    {
      type: "private",
      resource_type: "image",
      expires_at: Math.floor(Date.now() / 1000) + LINK_MINUTES * 60,
    },
  );
  await logActivity(user, {
    action: "document.view",
    module: "staff",
    summary: `Opened ${documentLabel(doc)} of ${doc.teacher?.name ?? doc.staff?.name ?? "someone"}`,
    entityType: "EmployeeDocument",
    entityId: doc.id,
  });
  return { url };
}

/** Deletes a document and its file. */
export async function deleteDocument(
  documentId: string,
): Promise<{ success: true } | { error: string }> {
  const user = await getAccess();
  if (!user) return { error: "Unauthorized" };
  const cloud = getCloudinary();
  if (!cloud) return { error: UPLOADS_NOT_SET_UP };

  const doc = await prisma.employeeDocument.findFirst({
    where: { id: String(documentId), schoolId: user.schoolId },
    include: {
      teacher: { select: { name: true } },
      staff: { select: { name: true } },
    },
  });
  if (!doc) return { error: DOCUMENT_NOT_FOUND };

  try {
    const result = await cloud.cloudinary.uploader.destroy(doc.publicId, {
      type: "private",
      resource_type: "image",
      invalidate: true,
    });
    if (result?.result !== "ok" && result?.result !== "not found") {
      return { error: "Couldn't delete the file. Try again." };
    }
  } catch {
    return { error: "Couldn't delete the file. Try again." };
  }
  await prisma.employeeDocument.delete({ where: { id: doc.id } });
  await logActivity(user, {
    action: "document.delete",
    module: "staff",
    summary: `Deleted ${documentLabel(doc)} of ${doc.teacher?.name ?? doc.staff?.name ?? "someone"}`,
    entityType: "EmployeeDocument",
    entityId: doc.id,
  });
  return { success: true };
}
