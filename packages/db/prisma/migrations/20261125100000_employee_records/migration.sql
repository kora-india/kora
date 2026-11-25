-- A teacher's or staff member's ID and bank details, and their documents.

CREATE TABLE "employee_details" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT,
    "staffId" TEXT,
    "panNumber" TEXT,
    "aadhaarEncrypted" TEXT,
    "aadhaarLast4" TEXT,
    "uanNumber" TEXT,
    "bankAccountHolder" TEXT,
    "bankName" TEXT,
    "bankAccountEncrypted" TEXT,
    "bankAccountLast4" TEXT,
    "bankIfsc" TEXT,
    "upiId" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_details_pkey" PRIMARY KEY ("id"),
    -- For exactly one teacher or one staff member.
    CONSTRAINT "employee_details_one_owner" CHECK (("teacherId" IS NULL) <> ("staffId" IS NULL))
);

CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT,
    "staffId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "fileName" TEXT NOT NULL,
    "format" TEXT,
    "bytes" INTEGER,
    "publicId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "uploadedById" TEXT,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "employee_documents_one_owner" CHECK (("teacherId" IS NULL) <> ("staffId" IS NULL))
);

CREATE UNIQUE INDEX "employee_details_teacherId_key" ON "employee_details"("teacherId");
CREATE UNIQUE INDEX "employee_details_staffId_key" ON "employee_details"("staffId");
CREATE INDEX "employee_details_schoolId_idx" ON "employee_details"("schoolId");
CREATE UNIQUE INDEX "employee_documents_publicId_key" ON "employee_documents"("publicId");
CREATE INDEX "employee_documents_schoolId_idx" ON "employee_documents"("schoolId");
CREATE INDEX "employee_documents_teacherId_idx" ON "employee_documents"("teacherId");
CREATE INDEX "employee_documents_staffId_idx" ON "employee_documents"("staffId");

ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
