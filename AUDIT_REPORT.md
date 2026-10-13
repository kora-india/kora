# Kora (SchoolOS) — Codebase Audit

**Commit reviewed:** `4309126` (2026-10-02)
**Date:** 2026-10-13
**Scope:** `apps/admin-web`, `apps/teacher-pwa`, `apps/desktop`, `packages/*` (schema, auth, db scripts)
**Method:** Static review of the source code. The app and test suite were not run, so behaviour described here is inferred from the code. Line numbers refer to the commit above.

> This document describes exploitable security issues. Keep it out of any public repository until the "Fix today" items are closed.

## How to read this

Each finding has an ID, a location, what goes wrong, and a suggested fix. Severity:

| Severity     | Meaning                                                                               |
| ------------ | ------------------------------------------------------------------------------------- |
| **Critical** | Exploitable now, or silently corrupts money or records for every school               |
| **High**     | Cross-tenant access, data loss in a normal workflow, or wrong billing in common cases |
| **Medium**   | Wrong or stale data, missing checks with limited reach, scaling problems              |
| **Low**      | Polish, consistency, latent risks not reachable today                                 |

## Contents

1. [Fix today](#1-fix-today)
2. [Cross-tenant access](#2-cross-tenant-access)
3. [Authorization and authentication](#3-authorization-and-authentication)
4. [Billing correctness](#4-billing-correctness)
5. [Data loss and integrity](#5-data-loss-and-integrity)
6. [Caching](#6-caching)
7. [Performance](#7-performance)
8. [Product and UX](#8-product-and-ux)
9. [Other notes](#9-other-notes)
10. [Suggested fix order](#10-suggested-fix-order)

---

## 1. Fix today

### S1 — Committed database password (Critical)

- **Where:** [apps/admin-web/.env.test](apps/admin-web/.env.test), loaded by [apps/admin-web/src/test/setup.ts](apps/admin-web/src/test/setup.ts)
- **Problem:** The file contains a live Neon connection string, password included, and it is tracked in git. It points at the same Neon instance as `BACKUP_DATABASE_URL`, the disaster-recovery copy that holds a full copy of production data (student and parent PII, payments).
- **Also:** `dotenv` does not override variables that are already set. In CI, `DATABASE_URL` is set, so CI uses its local Postgres. Locally, `pnpm test` uses this Neon database, and the e2e tests create and delete schools, users and OTPs there.
- **Fix:** Rotate the Neon password now. Remove the file and purge it from git history (`git filter-repo`). Point tests at a local or disposable database and keep test env files out of git.

### S2 — Plaintext user password in git (Critical)

- **Where:** [packages/db/check-password.js:14](packages/db/check-password.js#L14), plus [apps/admin-web/src/check-password.ts](apps/admin-web/src/check-password.ts)
- **Problem:** A real account's email address and plaintext password are committed.
- **Fix:** Change that account's password. Delete both files and purge them from history.

### S3 — Backdoor school-admin account in every school (Critical)

- **Where:** [apps/admin-web/src/lib/onboarding.ts:175-190](apps/admin-web/src/lib/onboarding.ts#L175-L190)
- **Problem:** Every school created through the setup wizard gets an extra school-admin user `admin.<subdomain>@schoolos.com` with the hard-coded password `Admin@123`. Subdomains are public (the wizard checks availability), so anyone can sign in as admin of any school.
- **Fix:** Delete these users in production (`email LIKE 'admin.%@schoolos.com'`). Remove the user creation from `seedInitialSchoolData`.

### S4 — Paid plans can be obtained for less, or for free (Critical)

- **Where:** [apps/admin-web/src/app/api/school/create/route.ts:113-128](apps/admin-web/src/app/api/school/create/route.ts#L113-L128), [apps/admin-web/src/app/api/payment/create-order/route.ts](apps/admin-web/src/app/api/payment/create-order/route.ts)
- **Problems:**
  - The order is never tied to the plan. Create an order for BASIC (₹999), pay it, then submit `plan: "ENTERPRISE"`; the signature still verifies.
  - Used payment IDs are never recorded, so one payment can create unlimited schools.
  - If `RAZORPAY_KEY_SECRET` is missing, the code uses `"dummy_secret"`, so anyone can compute a valid signature.
  - The signature comparison is not constant-time.
- **Fix:**
  - Store each order server-side with its plan and amount when it is created.
  - On create, look up the stored order, check it is unpaid and matches the plan, then mark it consumed in the same transaction.
  - Fail closed when the secret is missing.
  - Compare signatures with `crypto.timingSafeEqual`.

### S5 — Any logged-in user can create a school and be moved into it (High)

- **Where:** [apps/admin-web/src/app/api/school/create/route.ts:191-194](apps/admin-web/src/app/api/school/create/route.ts#L191-L194)
- **Problem:** The route only checks that the user is signed in. A teacher, accountant, or an admin who already has a school can call it. The user's `schoolId` is overwritten, so an existing school loses its admin, and a teacher ends up attached to a new school with the TEACHER role.
- **Fix:** Require `role === "SCHOOL_ADMIN"` and `schoolId === null`.

### S6 — Cron endpoints are public when `CRON_SECRET` is unset (High)

- **Where:** [apps/admin-web/src/app/api/cron/generate-fees/route.ts:19-26](apps/admin-web/src/app/api/cron/generate-fees/route.ts#L19-L26), [apps/admin-web/src/app/api/cron/apply-late-fees/route.ts:16](apps/admin-web/src/app/api/cron/apply-late-fees/route.ts#L16)
- **Problem:** Without the secret, anyone can trigger fee generation and late fees for every school. The routes also sit under the public `/api/cron` middleware path.
- **Fix:** Fail closed (return 401) if `CRON_SECRET` is not set, and confirm it is set in Vercel.

---

## 2. Cross-tenant access

Server actions accept IDs from the browser and do not check that the referenced records belong to the caller's school. A user in school A can read or change school B's records if they have (or guess) a record ID. All IDs are CUIDs, which makes guessing hard, but they leak through URLs, receipts and exports.

| ID  | Action                                     | Location                                                                                                      | What can happen                                                                                                                                                  |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | `allocatePayment`                          | [fee-allocator.ts:129-176](apps/admin-web/src/lib/actions/fee-allocator.ts#L129-L176)                         | `studentId` and `chargeId` are not scoped. Another school's fees can be marked paid; the payment row is created under the caller's school.                       |
| T2  | `waiveFeeChargeItem`                       | [fee-allocator.ts:787-803](apps/admin-web/src/lib/actions/fee-allocator.ts#L787-L803)                         | Waives any fee item by ID, in any school.                                                                                                                        |
| T3  | `markAttendance`                           | [attendance.ts:61-75](apps/admin-web/src/lib/actions/attendance.ts#L61-L75)                                   | Upsert matches on `studentId + date` only, so another school's attendance can be overwritten. Students are not checked to belong to the submitted class/section. |
| T4  | `POST /api/attendance` (admin)             | [api/attendance/route.ts:38-55](apps/admin-web/src/app/api/attendance/route.ts#L38-L55)                       | Same as T3. Also has no role check (accountants can mark) and no teacher-assignment check.                                                                       |
| T5  | `POST /api/attendance` (PWA)               | [teacher-pwa/src/app/api/attendance/route.ts:39-47](apps/teacher-pwa/src/app/api/attendance/route.ts#L39-L47) | Same as T3.                                                                                                                                                      |
| T6  | `setStudentFeeOverride`                    | [fee-settings.ts:155-204](apps/admin-web/src/lib/actions/fee-settings.ts#L155-L204)                           | Exemptions/discounts can be set on another school's student.                                                                                                     |
| T7  | `assignFeeStructureToClass`                | [fee-settings.ts:120-152](apps/admin-web/src/lib/actions/fee-settings.ts#L120-L152)                           | Class and structure IDs not checked.                                                                                                                             |
| T8  | `createFeeStructure`, `updateFeeStructure` | [fee-settings.ts:88-117](apps/admin-web/src/lib/actions/fee-settings.ts#L88-L117)                             | Can reference another school's session and components.                                                                                                           |
| T9  | `enrollStudentTransport`                   | [transport.ts:336-374](apps/admin-web/src/lib/actions/transport.ts#L336-L374)                                 | Student, route, stop and vehicle not checked; stop not checked to belong to the route.                                                                           |
| T10 | `updateVehicle`                            | [transport.ts:189-201](apps/admin-web/src/lib/actions/transport.ts#L189-L201)                                 | Raw input is passed to Prisma with no validation, so the caller can set any column, including `schoolId`.                                                        |
| T11 | `saveTimetableSlot`                        | [timetable.ts:203-275](apps/admin-web/src/lib/actions/timetable.ts#L203-L275)                                 | Class, section and teacher IDs not checked.                                                                                                                      |
| T12 | `createStudent`, `updateStudent`           | [students.ts:123-130](apps/admin-web/src/lib/actions/students.ts#L123-L130)                                   | Class and section not checked against the school, and section not checked against the class.                                                                     |
| T13 | `createClass`, `updateClass`               | [classes.ts:97-104](apps/admin-web/src/lib/actions/classes.ts#L97-L104)                                       | `classTeacherId` not checked.                                                                                                                                    |
| T14 | `createAssignment` (admin path)            | [assignments.ts:60-63](apps/admin-web/src/lib/actions/assignments.ts#L60-L63)                                 | Class looked up by ID without `schoolId`.                                                                                                                        |
| T15 | `createExpense`                            | [expenses.ts:58-73](apps/admin-web/src/lib/actions/expenses.ts#L58-L73)                                       | `categoryId` not checked.                                                                                                                                        |
| T16 | `saveBatchMarks`, `createExam` subjects    | [exams.ts:385-461](apps/admin-web/src/lib/actions/exams.ts#L385-L461)                                         | Student and class IDs not checked.                                                                                                                               |
| T17 | `generateMonthlyFees`                      | [fee-generator.ts:390-417](apps/admin-web/src/lib/actions/fee-generator.ts#L390-L417)                         | `sessionId` not checked.                                                                                                                                         |
| T18 | `getNextAdmissionNumber`                   | [admission-settings.ts:175-189](apps/admin-web/src/lib/actions/admission-settings.ts#L175-L189)               | The collision check searches every school's students, which reveals which admission numbers exist elsewhere.                                                     |

**Fix:** Add one helper (for example `assertOwned(model, ids, schoolId)`) and call it in every action that accepts IDs. Alternatively, always include `schoolId` in `where` clauses and use `updateMany`/`deleteMany` with `schoolId` so a foreign ID matches nothing. A Prisma client extension that injects `schoolId` would prevent regressions.

---

## 3. Authorization and authentication

### A1 — Exam actions have no role checks (High)

- **Where:** [apps/admin-web/src/lib/actions/exams.ts](apps/admin-web/src/lib/actions/exams.ts) (every exported function)
- **Problem:** Each action only checks that the user has a `schoolId`. Any teacher or accountant can create exams, delete exams (cascading every mark), publish results, and overwrite marks for any subject.
- **Fix:** Require SCHOOL_ADMIN for exam setup and deletion. Allow teachers to enter marks only for subjects and sections they teach.

### A2 — Timetable actions have no role checks (High)

- **Where:** [apps/admin-web/src/lib/actions/timetable.ts](apps/admin-web/src/lib/actions/timetable.ts)
- **Problem:** Any school user can replace period settings, clear a section's timetable, delete slots, and run the AI generator, which calls the paid Gemini API. There is no rate limit on the AI call.
- **Fix:** Restrict writes to SCHOOL_ADMIN and add a per-school rate limit on AI generation.

### A3 — Student import has no role or plan-limit check (High)

- **Where:** [apps/admin-web/src/lib/actions/student-import.ts:22-28](apps/admin-web/src/lib/actions/student-import.ts#L22-L28)
- **Problem:** Any role can bulk-import students and auto-create classes and sections. It skips `checkStudentLimit` and `checkClassLimit`, so a FREE school (50 students) can import unlimited students.
- **Fix:** Require SCHOOL_ADMIN and enforce plan limits against the post-import count.

### A4 — Plan gates are only enforced on pages (Medium)

- **Where:** [exams/page.tsx](<apps/admin-web/src/app/(dashboard)/exams/page.tsx>), [timetable/page.tsx](<apps/admin-web/src/app/(dashboard)/timetable/page.tsx>), [transport/page.tsx](<apps/admin-web/src/app/(dashboard)/transport/page.tsx>)
- **Problem:** The EXAMS and TIMETABLE gates are checked when the page renders but not in the server actions. TRANSPORT is not gated anywhere, although `hasFeatureAccess` says it needs BASIC or higher.
- **Fix:** Check `hasFeatureAccess` inside the actions too.

### A5 — Suspended schools keep working through server actions (Medium)

- **Where:** [apps/admin-web/src/app/(dashboard)/layout.tsx:43-46](<apps/admin-web/src/app/(dashboard)/layout.tsx#L43-L46>)
- **Problem:** Only the layout redirects to `/suspended`. Most actions use local `getAdminSession` helpers that do not check `school.isActive`. `requireSchoolAdmin` in [auth-guard.ts](apps/admin-web/src/lib/auth-guard.ts) does check it, but almost nothing uses it.
- **Fix:** Use one shared session guard everywhere that checks the user's role, `isActive`, and the school's `isActive`.

### A6 — Sessions are never re-validated (High)

- **Where:** [packages/auth/src/index.ts:57-75](packages/auth/src/index.ts#L57-L75)
- **Problem:** The JWT is trusted until it expires (30 days by default). A deactivated teacher, or a user whose school was suspended, keeps access. Changing or resetting a password does not end other sessions. Role changes do not take effect until the user signs out.
- **Fix:** Shorten the session lifetime and re-read `isActive`, `role` and `schoolId` from the database in the `jwt` callback, at least every few minutes. Store a `passwordChangedAt` or token version and reject older tokens.

### A7 — No rate limit on login (High)

- **Where:** [packages/auth/src/index.ts:25-53](packages/auth/src/index.ts#L25-L53)
- **Problem:** `authRatelimit` exists but is only used by registration. Passwords can be brute-forced, and the minimum length is 6.
- **Fix:** Rate-limit `authorize` per IP and per email. Raise the minimum password length.

### A8 — Password reset reveals accounts and can be abused (Medium)

- **Where:** [apps/admin-web/src/lib/actions/password-reset.ts:31-44](apps/admin-web/src/lib/actions/password-reset.ts#L31-L44)
- **Problems:**
  - It tells the caller whether an email is registered or deactivated.
  - There is no rate limit, so it can be used to flood an inbox.
  - The reset token is stored in plain text.
  - If `NEXTAUTH_URL` is unset, the email link becomes `undefined/reset-password?...`.
- **Fix:** Always return the same message. Rate-limit by IP and email. Store a SHA-256 hash of the token.

### A9 — OTP weaknesses (Medium)

- **Where:** [apps/admin-web/src/app/api/auth/send-otp/route.ts](apps/admin-web/src/app/api/auth/send-otp/route.ts), [apps/admin-web/src/app/api/auth/register/route.ts](apps/admin-web/src/app/api/auth/register/route.ts)
- **Problems:**
  - The OTP is generated with `Math.random` and stored in plain text.
  - The rate limit key is `ip:email`, so one IP can send OTP emails to unlimited addresses.
  - It reveals whether an email is registered.
  - Guessing is limited per IP only, not per email.
  - In production without SMTP, it returns "OTP sent successfully" but sends nothing, so registration is impossible.
- **Fix:** Use `crypto.randomInt`, hash the OTP, add a per-email attempt counter, rate-limit per IP across all emails, and return an error when email is not configured.

### A10 — Unauthenticated exported functions in `"use server"` files (Low, latent)

- **Where:** `getStaffList(schoolId)` in [staff.ts:127](apps/admin-web/src/lib/actions/staff.ts#L127), `processClassFeeGeneration(schoolId, …)` in [fee-generator.ts:18](apps/admin-web/src/lib/actions/fee-generator.ts#L18), `getOrCreateTransportFeeComponent(schoolId)` in [transport.ts:31](apps/admin-web/src/lib/actions/transport.ts#L31)
- **Problem:** Every export of a `"use server"` file is a potential public endpoint. These take a `schoolId` argument and do no auth check. Next.js 15 hides unused action IDs from client bundles, so they are probably not reachable today, but one client import would expose them.
- **Fix:** Move these into a plain server-only module (`import "server-only"`).

### A11 — Weak temporary passwords (Low)

- **Where:** [teachers.ts:34-40](apps/admin-web/src/lib/actions/teachers.ts#L34-L40), [schools.ts:28-31](apps/admin-web/src/lib/actions/schools.ts#L28-L31)
- **Problem:** Generated with `Math.random`. There is no forced change on first login.
- **Fix:** Use `crypto.randomInt`, and add a `mustChangePassword` flag.

### A12 — Notice publish toggle has no ownership check (Low)

- **Where:** [notices.ts:105-121](apps/admin-web/src/lib/actions/notices.ts#L105-L121)
- **Problem:** Teachers can only edit or delete their own notices, but they can publish or unpublish anyone's.

### A13 — Teacher PWA has no role check (Low)

- **Where:** [apps/teacher-pwa/src/middleware.ts](apps/teacher-pwa/src/middleware.ts)
- **Problem:** Any signed-in role can use the PWA.

---

## 4. Billing correctness

### B1 — Fee generator ignores component frequency: about 5.5× overbilling (Critical)

- **Where:** [fee-generator.ts:158-182](apps/admin-web/src/lib/actions/fee-generator.ts#L158-L182), [onboarding.ts:199-206](apps/admin-web/src/lib/onboarding.ts#L199-L206)
- **Problem:** Every component in the class structure is added to every monthly charge. `FeeComponent.frequency` and `isActive` are never read. The default structure seeded at setup includes Admission Fee (₹5,000, ONE_TIME), Annual Charges (₹3,000, YEARLY) and Examination Fee (₹600, QUARTERLY). Each student is billed ₹10,500 every month instead of ₹1,900.
- **Fix:** Decide per component whether it is due in the target month (monthly always; quarterly on quarter starts; yearly and one-time once per session, tracked so they are not billed twice). Skip inactive components.

### B2 — Cron and manual generation double-bill the same month (Critical)

- **Where:** [cron/generate-fees/route.ts:53](apps/admin-web/src/app/api/cron/generate-fees/route.ts#L53), [generator-tab.tsx:67](apps/admin-web/src/components/fees/tabs/generator-tab.tsx#L67), [fee-generator.ts:57-63](apps/admin-web/src/lib/actions/fee-generator.ts#L57-L63)
- **Problem:** Duplicates are detected only by exact title match. The cron titles a month "October 2026"; the manual generator defaults to "October 2026 Tuition Fee", and the title is free text. A school that generates manually is billed again by the cron on the 1st. Two concurrent runs can also both pass the check, because there is no database constraint.
- **Fix:** Add a structured period key (for example `periodKey = "2026-10"`) to `FeeCharge` with a unique constraint on `(studentId, sessionId, periodKey)`. Let schools opt in or out of automatic generation.

### B3 — Wrong fee structure can be used (High)

- **Where:** [fee-generator.ts:34-45](apps/admin-web/src/lib/actions/fee-generator.ts#L34-L45), [fee-settings.ts:129-142](apps/admin-web/src/lib/actions/fee-settings.ts#L129-L142)
- **Problem:** The structure is found with `findFirst({ classId })`, with no session filter and no ordering, so it can bill using last year's structure. Assigning a structure overwrites the class's only assignment, whatever its session. The `StudentFeeAssignment` model exists but is never used, and `FeeStructure.status` is ignored.
- **Fix:** Select the structure by `(classId, structure.sessionId = sessionId, status = ACTIVE)` and allow one assignment per class per session.

### B4 — Receipt numbers collide and are not sequential (High)

- **Where:** [fee-allocator.ts:124](apps/admin-web/src/lib/actions/fee-allocator.ts#L124), [fee-generator.ts:326](apps/admin-web/src/lib/actions/fee-generator.ts#L326), [schema.prisma:538](packages/db/prisma/schema.prisma#L538)
- **Problem:** Receipts are `RCP-YYYY-` plus 5 random digits (90,000 values), and `receiptNo` is unique across all schools. A collision becomes likely once there are a few hundred receipts a year across the platform, and grows quickly after that. A collision fails the payment with a raw Prisma error. In the generator, an `ADV-` collision aborts fee generation for the whole class. Random numbers also do not give the sequential receipt series that audits and GST records expect.
- **Fix:** Keep a per-school counter row and allocate with `UPDATE … SET next = next + 1 RETURNING next` inside the payment transaction. Make the unique constraint `(schoolId, receiptNo)`.

### B5 — Concurrent payments overwrite each other (High)

- **Where:** [fee-allocator.ts:245-254](apps/admin-web/src/lib/actions/fee-allocator.ts#L245-L254) (and the equivalent blocks at 296-305 and 359-368)
- **Problem:** `paidAmount` is read, increased in JavaScript, and written back as a fixed value. Under the default isolation level, two payments on the same item (two counters, two tabs, a double click) both read the old value, and one update is lost. Both payment rows still exist, so the ledger and the dues disagree.
- **Fix:** Lock the charge items (`SELECT … FOR UPDATE`, or Serializable isolation with retry) and use `paidAmount: { increment }`. Add an idempotency key from the client so a double submit becomes a no-op.

### B6 — No input validation on payments; negative amounts accepted (High)

- **Where:** [fee-allocator.ts:71-103](apps/admin-web/src/lib/actions/fee-allocator.ts#L71-L103)
- **Problem:** The total is the sum of all entered amounts, including negatives, but allocation skips any entry ≤ 0. Example: `[{charge A: 1000}, {charge B: -900}]` records ₹100 received and marks ₹1,000 paid. `method` is not validated either.
- **Fix:** Validate with zod: positive amounts with at most 2 decimals, a valid enum method, at most one entry per charge.

### B7 — Payments can be saved with nothing allocated (Medium)

- **Where:** [fee-allocator.ts:176](apps/admin-web/src/lib/actions/fee-allocator.ts#L176), [283](apps/admin-web/src/lib/actions/fee-allocator.ts#L283)
- **Problem:** Unknown or foreign charge IDs are skipped with `continue`. The payment transaction is still saved with its full amount, but no allocation or advance is recorded.
- **Fix:** Throw if any requested charge or item is missing, so the transaction rolls back.

### B8 — Money calculated with floating point (Medium)

- **Where:** fee allocator, generator, receipts, dashboard
- **Problem:** Amounts are converted to JS numbers and added. Paise values can drift, and checks such as `newPaidAmount >= amount` can fail by a fraction.
- **Fix:** Use `Prisma.Decimal` arithmetic, or integer paise throughout.

### B9 — Policy checks only apply to month payments (Low)

- **Where:** [fee-allocator.ts:190-220](apps/admin-web/src/lib/actions/fee-allocator.ts#L190-L220)
- **Problem:** FULL_ONLY and minimum-partial rules are skipped for item-wise and component-wise payments. Item payments also allocate to WAIVED items, which silently un-waives them.

### B10 — Waivers are incomplete and unaudited (Medium)

- **Where:** [fee-allocator.ts:787-803](apps/admin-web/src/lib/actions/fee-allocator.ts#L787-L803)
- **Problem:**
  - The parent charge's status is not recalculated, so a charge whose items are all waived or paid stays PENDING.
  - No reason or approver is recorded.
  - Any amount already paid on a waived item disappears from totals that skip WAIVED items.
- **Fix:** Recalculate charge status and store `waivedBy`, `waivedAt` and `waiverReason`. Handle partially paid items, either by waiving only the remainder or by moving the paid amount to an advance.

### B11 — Fee collection fails for students with transport (High)

- **Where:** [fee-allocator.ts:840-860](apps/admin-web/src/lib/actions/fee-allocator.ts#L840-L860), [onboarding.ts:138-148](apps/admin-web/src/lib/onboarding.ts#L138-L148)
- **Problem:**
  - `getStudentFeeDues` writes to the database every time it is read, adding a transport item to the latest open charge.
  - It looks up the component with `category: "TRANSPORT"`, but setup seeds it with `category: "Transport"`. Postgres matching is case-sensitive, so the lookup fails and it tries to create a second "Transport Fee". That fails on the `(schoolId, name)` unique constraint.
  - Result: the collection screen errors for every student with active transport in any school created through setup.
  - Two simultaneous views can also race on the unique `(chargeId, componentId)`.
- **Fix:** Make the read side-effect free. Look up the transport component one consistent way (one constant, case-insensitive), as `transport.ts` and the generator already do by name.

### B12 — Receipts are inaccurate (Medium)

- **Where:** [fee-allocator.ts:513-522](apps/admin-web/src/lib/actions/fee-allocator.ts#L513-L522), [671-713](apps/admin-web/src/lib/actions/fee-allocator.ts#L671-L713)
- **Problems:**
  - "Previously paid" and "balance" are calculated from today's data, so a receipt reprinted after later payments shows different numbers.
  - The timestamp is formatted in the server's time zone (UTC on Vercel), so it is 5h30m behind IST.
  - "Items" show one month's rate per fee head rather than the amounts actually paid.
  - "Paid for" reads like "October 2026 - October 2026" for a single month.
  - The fallback school name is the hard-coded "Horizon Private School".
- **Fix:** Store a receipt snapshot (JSON) when the payment is made and render reprints from it. Format dates with `timeZone: school.timezone ?? "Asia/Kolkata"`.

### B13 — Late fees never apply automatically (High)

- **Where:** [vercel.json](vercel.json), [cron/apply-late-fees/route.ts](apps/admin-web/src/app/api/cron/apply-late-fees/route.ts)
- **Problem:** Only `generate-fees` is scheduled, so charges never become OVERDUE and late fees are never added. When it does run:
  - it charges withdrawn (inactive) students too;
  - DAILY frequency has no cap;
  - midnight uses the server's time zone.
- **Fix:** Add the cron schedule. Filter on `student.isActive`. Add a maximum late fee per charge.

### B14 — Legacy fee migration is unsafe (Medium)

- **Where:** [fee-migration.ts:66](apps/admin-web/src/lib/actions/fee-migration.ts#L66)
- **Problem:** WAIVED and OVERDUE legacy fees become PARTIAL, so waived fees show as due. Running it twice duplicates charges whenever no payments exist. Legacy rows are not marked as migrated. Accountants can run it.
- **Fix:** Map statuses correctly, mark source rows as migrated, and restrict to SCHOOL_ADMIN.

### B15 — Changing the current session can leave none (Medium)

- **Where:** [fee-settings.ts:29-45](apps/admin-web/src/lib/actions/fee-settings.ts#L29-L45), [220-235](apps/admin-web/src/lib/actions/fee-settings.ts#L220-L235)
- **Problem:** `isCurrent` is cleared on every session first, then the new or updated session is saved, outside a transaction. If the save fails (duplicate name, bad date), the school has no current session, and the cron skips it. There is no input validation (start after end, empty name).
- **Fix:** Wrap both steps in `$transaction` and validate input with zod.

### B16 — Dues include withdrawn students (Low)

- **Where:** [dashboard/page.tsx:18-28](<apps/admin-web/src/app/(dashboard)/dashboard/page.tsx#L18-L28>)
- **Problem:** Pending fees are summed for all students, including inactive ones. Withdrawing a student leaves their future charges open.
- **Fix:** Filter on `student.isActive`, and offer to close or waive open charges when a student is withdrawn.

### B17 — Two fee systems in parallel (Low)

- **Problem:** The legacy `Fee`/`Payment` models and actions ([fees.ts](apps/admin-web/src/lib/actions/fees.ts)) still exist next to `FeeCharge`/`PaymentTransaction`. Student details include both, and the teacher PWA shows only legacy `fees`.
- **Fix:** Finish the migration and remove the legacy models.

---

## 5. Data loss and integrity

### D1 — Editing a transport route deletes all its student enrollments (Critical)

- **Where:** [transport.ts:290](apps/admin-web/src/lib/actions/transport.ts#L290), [schema.prisma:868](packages/db/prisma/schema.prisma#L868)
- **Problem:** `updateRoute` deletes every `RouteStop` and recreates them. `StudentTransport.stop` is `onDelete: Cascade`, so saving any change to a route (even its name) deletes every student enrolled on it. Their transport fees stop being generated. `deleteRoute` also cascades, while its confirm dialog says it will only "unassign any active stops" ([transport-content.tsx:138-143](apps/admin-web/src/components/transport/transport-content.tsx#L138-L143)).
- **Fix:** Update stops in place: update the ones with an `id`, create new ones, and refuse to delete stops that still have enrollments. Change the relation to `Restrict`. Make the delete dialog show how many students will be affected.

### D2 — Attendance saved onto the wrong date (High)

- **Where:** [attendance-content.tsx:302](apps/admin-web/src/components/attendance/attendance-content.tsx#L302)
- **Problem:** Changing class or section clears the loaded students, but changing the date does not. Load Monday, switch to Tuesday, click Save, and Monday's statuses overwrite Tuesday's attendance.
- **Fix:** Clear `students` and `attendance` when the date changes, or reload automatically.

### D3 — Admission numbers collide between schools (High)

- **Where:** [schema.prisma:190](packages/db/prisma/schema.prisma#L190), [schema.prisma:45](packages/db/prisma/schema.prisma#L45), [admission-settings.ts:156-189](apps/admin-web/src/lib/actions/admission-settings.ts#L156-L189)
- **Problems:**
  - `admissionNumber` is unique across all schools.
  - Every school's prefix defaults to `"SCH"` (non-null), so the subdomain-based fallback never runs. The second school's `SCH-2026-0001` fails.
  - The next-number lookup checks all schools (see T18), runs up to 100 sequential queries, and `createStudent` only increments the counter by 1, so the scan gets longer over time.
  - After 100 attempts it returns a number that is already taken.
- **Fix:** Make the constraint `(schoolId, admissionNumber)`. Default the prefix from the subdomain at school creation. Allocate the number atomically from the counter when the student is created.

### D4 — Roll numbers are unique per class, not per section (High)

- **Where:** [schema.prisma:219](packages/db/prisma/schema.prisma#L219), [student-import.ts:201-207](apps/admin-web/src/lib/actions/student-import.ts#L201-L207), [student-import.ts:255](apps/admin-web/src/lib/actions/student-import.ts#L255)
- **Problem:** Indian schools number rolls per section, but the constraint is `(schoolId, rollNumber, classId)`, so Section B cannot have roll 1 if Section A does. The importer generates rolls per section, and `createMany({ skipDuplicates: true })` then silently drops the clashing students. They are reported only as an unexplained "failed" count.
- **Fix:** Change the constraint to `(sectionId, rollNumber)`. Stop using `skipDuplicates` in the import, and report each rejected row with its reason.

### D5 — Student import corrupts dates of birth (High)

- **Where:** [import-students-dialog.tsx:128](apps/admin-web/src/components/students/import-students-dialog.tsx#L128), [student-import.ts:222-226](apps/admin-web/src/lib/actions/student-import.ts#L222-L226)
- **Problem:** The workbook is read without `cellDates`, so Excel date cells arrive as serial numbers. `new Date("40321")` is year 40321. `"05/06/2010"` (5 June in India) is read as 6 May. `"15/06/2010"` is invalid and becomes `null` without any warning.
- **Fix:** Read with `{ cellDates: true }`. Parse text dates explicitly as DD/MM/YYYY (date-fns `parse`). Reject unparseable dates in the preview instead of dropping them.

### D6 — Other import problems (Medium)

- **Where:** [student-import.ts](apps/admin-web/src/lib/actions/student-import.ts)
- **Problems:**
  - Classes and sections are created one at a time, outside a transaction. If the insert fails, they stay behind.
  - Unknown class names create new classes: "5", "Class 5" and "V" become three classes.
  - The grade guess for named classes ("Nursery") is 1.
  - The duplicate check covers only this school, but admission numbers are unique globally (D3), so rows matching another school's numbers are silently dropped.
- **Fix:** Map rows to existing classes in the preview step, run the import in one transaction, and validate admission numbers against the correct constraint.

### D7 — Saving period settings breaks every slot (High)

- **Where:** [timetable.ts:87-105](apps/admin-web/src/lib/actions/timetable.ts#L87-L105)
- **Problem:** All periods are deleted and recreated. Every `TimetableSlot.periodId` is set to null by `onDelete: SetNull`. If any start time changed, slots at the old time no longer match a period and disappear from the grid. There is no validation for overlapping periods or duplicate start times.
- **Fix:** Update periods by `id`. When a period's time changes, update its slots' `startTime`/`endTime` in the same transaction.

### D8 — Moving a timetable slot duplicates it (Medium)

- **Where:** [timetable.ts:240-271](apps/admin-web/src/lib/actions/timetable.ts#L240-L271)
- **Problem:** The slot dialog lets you change day and time when editing, but the save upserts by `(school, section, day, startTime)` rather than by `id`. A new slot is created at the target time and the original stays.
- **Fix:** If `data.id` is present, update that row by id. Upsert only for new slots.

### D9 — "Replace existing" is not atomic (Medium)

- **Where:** [timetable.ts:397-435](apps/admin-web/src/lib/actions/timetable.ts#L397-L435), [timetable.ts:620-658](apps/admin-web/src/lib/actions/timetable.ts#L620-L658)
- **Problem:** Existing slots are deleted, then new ones are inserted, outside a transaction. If the insert fails, the section's timetable is gone.
- **Fix:** Wrap the delete and create in one `$transaction`.

### D10 — Period seeding on first read can fail (Low)

- **Where:** [timetable.ts:45-66](apps/admin-web/src/lib/actions/timetable.ts#L45-L66)
- **Problem:** Two simultaneous first loads both seed the defaults, and one fails on the `(schoolId, startTime)` unique constraint.

### D11 — Marks entry silently changes data (High)

- **Where:** [exams.ts:412-435](apps/admin-web/src/lib/actions/exams.ts#L412-L435), [marks-entry-tab.tsx:164-185](apps/admin-web/src/components/exams/tabs/marks-entry-tab.tsx#L164-L185)
- **Problems:**
  - Non-numeric input is saved as 0, and marks above the maximum are clamped, without telling the user.
  - Marks stay editable after the exam is published.
  - The whole sheet is saved, including untouched rows. A teacher who loaded "all sections" before a colleague saved will overwrite the colleague's marks with blanks.
  - There is no warning when leaving with unsaved changes.
- **Fix:** Reject invalid values with per-row errors. Lock marks after publishing. Save only changed rows, and use `updatedAt` for optimistic concurrency. Add an unsaved-changes guard.

### D12 — Grading ignores the pass mark (High)

- **Where:** [grading.ts:54-121](apps/admin-web/src/lib/grading.ts#L54-L121), [grading.ts:151-205](apps/admin-web/src/lib/grading.ts#L151-L205)
- **Problems:**
  - For CBSE_9_POINT and PERCENTAGE_LETTER, `isPass` is hard-coded from the grade band, so a subject's `passMarks` is ignored. For example, with a pass mark of 40, a score of 35 shows as Pass.
  - Subjects not yet marked still add to the maximum total, so percentage and CGPA come out low while marking is in progress.
  - The overall grade always uses a pass mark of 33.
  - A single absent subject makes the result "COMPARTMENT".
- **Fix:** Use `marksObtained >= passMarks` for `isPass` in every system. Exclude unmarked subjects from totals, or show the result as "Pending".

### D13 — Removing a record keeps its unique values (Medium)

- **Where:** [students.ts:197-219](apps/admin-web/src/lib/actions/students.ts#L197-L219), [teachers.ts:226-251](apps/admin-web/src/lib/actions/teachers.ts#L226-L251), [classes.ts:191-208](apps/admin-web/src/lib/actions/classes.ts#L191-L208)
- **Problem:** Students and teachers are only marked inactive.
  - Their roll number, admission number and email stay reserved, so you cannot re-admit a student with the same roll or re-hire a teacher with the same email.
  - A class with any inactive student, or any attendance history, can never be deleted.
  - Deactivated teachers stay as class teacher and keep their timetable slots.
  - Withdrawn students keep active transport enrollments and open charges.
- **Fix:** Add a withdrawal flow that ends transport, handles open charges, and releases or archives the roll number. Use partial unique indexes that only apply to active rows. Clear class-teacher and timetable assignments when a teacher is deactivated.

### D14 — Migrations are out of date with the schema (High)

- **Where:** [packages/db/prisma/migrations/](packages/db/prisma/migrations), [.github/workflows/ci.yml](.github/workflows/ci.yml)
- **Problem:** The migrations cover only the initial tables and transport. Twelve tables exist only through `db push`:
  - `teacher_sections`
  - `exams`, `exam_subjects`, `exam_marks`
  - `timetable_periods`, `timetable_slots`
  - `salary_slips`, `payroll_payouts`
  - plus later columns on `schools`

  `prisma migrate deploy` (`pnpm db:deploy`) produces a broken database. CI runs `db push --accept-data-loss`.

- **Fix:** Create a baseline migration with `prisma migrate diff` against production, mark it applied, use `migrate deploy` from then on, and have CI run migrations instead of `db push`.

### D15 — Disaster-recovery sync misses data (High)

- **Where:** [packages/db/src/scripts/backup-sync.ts:32-62](packages/db/src/scripts/backup-sync.ts#L32-L62), [backup-sync.ts:143-166](packages/db/src/scripts/backup-sync.ts#L143-L166)
- **Problem:**
  - Twelve models are not copied: teacher sections, vehicles, routes, stops, student transport, exams, exam subjects, exam marks, timetable periods, timetable slots, salary slips, payroll payouts. A failover loses all of them.
  - Every error is swallowed and the script still prints "Done".
  - Deletes are never propagated.
  - Whole tables are loaded into memory and copied row by row.
- **Fix:** Use your provider's point-in-time recovery (Neon/Supabase) or scheduled `pg_dump` for disaster recovery. If you keep a sync, generate the model list from the Prisma schema and fail loudly on errors.

### D16 — Subscription status evaluated incorrectly (Medium)

- **Where:** [subscription.ts:37-113](apps/admin-web/src/lib/subscription.ts#L37-L113), [schools.ts:161-181](apps/admin-web/src/lib/actions/schools.ts#L161-L181)
- **Problems:**
  - A subscription explicitly marked EXPIRED or PAST_DUE with no `currentPeriodEnd` evaluates as ACTIVE. Only CANCELLED is honoured, although the comment says EXPIRED is too.
  - `updateSchoolPlan` changes `school.plan` but not `subscription.plan`. Plan limits read `school.plan`, while the layout and topbar read `subscription.plan`.
  - Schools created by the super admin get no subscription row.
- **Fix:** Honour stored terminal statuses. Keep the plan in one place.

### D17 — Cascade deletes put payment history at risk (Low, latent)

- **Where:** [schema.prisma](packages/db/prisma/schema.prisma): `PaymentTransaction.student` (Cascade), `FeeChargeItem.component` → `PaymentAllocation.chargeItem` (Cascade), `SalarySlip.teacher` (Cascade), `FeeStructure.session` (Cascade)
- **Problem:** No UI path hard-deletes these parents today, but one manual delete or future feature would erase receipts and salary history.
- **Fix:** Change financial relations to `onDelete: Restrict`.

### D18 — `deleteClass` hides the real error (Low)

- **Where:** [classes.ts:205-207](apps/admin-web/src/lib/actions/classes.ts#L205-L207)
- **Problem:** Every failure returns "Cannot delete class with existing students or sections", even when the real cause is attendance or fee history, or an unrelated error.

---

## 6. Caching

### C1 — One Redis key holds data of different shapes (High)

- **Where:**
  - `cache:<school>:classes:list`: [students/page.tsx:49](<apps/admin-web/src/app/(dashboard)/students/page.tsx#L49>) (with sections), [fees/page.tsx:40](<apps/admin-web/src/app/(dashboard)/fees/page.tsx#L40>) (sections and `classFeeStructures`), [ledger/page.tsx:139](<apps/admin-web/src/app/(dashboard)/ledger/page.tsx#L139>) (id, name, grade only)
  - `cache:<school>:school:details`: [fees/page.tsx:20](<apps/admin-web/src/app/(dashboard)/fees/page.tsx#L20>) (full row), [ledger/page.tsx:37](<apps/admin-web/src/app/(dashboard)/ledger/page.tsx#L37>) (name only)
- **Problem:** Whichever page loads first decides the shape for up to an hour. If the ledger loads first:
  - the students page gets classes without sections, so the student dialog cannot pick a section and nobody can add students;
  - the fees page gets no structure assignments, and its school object lacks `feePaymentMode`, late-fee and partial-payment settings. Saving the policy form then overwrites the real settings with defaults.
- **Fix:** Give each query shape its own key (`classes:withSections`, `classes:basic`, and so on), or build keys from one helper that includes the select shape.

### C2 — Ledger cache is never cleared (Medium)

- **Where:** [ledger/page.tsx:43-131](<apps/admin-web/src/app/(dashboard)/ledger/page.tsx#L43-L131>), [redis.ts:86-99](apps/admin-web/src/lib/redis.ts#L86-L99)
- **Problem:** The `ledger:*` keys use the default 1-hour TTL and nothing invalidates them. New payments and expenses take up to an hour to appear in the page described as the "immutable source of truth".
- **Fix:** Add `ledger:*` to `invalidateFeesCache`, and invalidate it on expense changes.

### C3 — Transport cache stores the viewer's role (High)

- **Where:** [transport.ts:145](apps/admin-web/src/lib/actions/transport.ts#L145), [transport-content.tsx:113-114](apps/admin-web/src/components/transport/transport-content.tsx#L113-L114)
- **Problem:** `userRole` is stored inside the shared 5-minute cache entry. A teacher who loads the page after an admin sees edit and delete controls. An admin who loads after a teacher gets a read-only screen.
- **Fix:** Return `userRole` outside the cached value.

### C4 — Error results are cached (Low)

- **Where:** [transport.ts:476](apps/admin-web/src/lib/actions/transport.ts#L476)
- **Problem:** `{ error: "Route not found" }` is cached for 5 minutes.

### C5 — Cached and fresh data have different types (Medium)

- **Where:** [redis.ts:16-46](apps/admin-web/src/lib/redis.ts#L16-L46)
- **Problem:** On a cache miss, callers get Prisma objects (`Date`, `Decimal`). On a hit, they get JSON (strings). Code that calls `.getTime()` or `.toLocaleDateString()` works on a miss and crashes on a hit.
- **Fix:** Serialize before returning on a miss too (or use superjson), so both paths return the same shape.

### C6 — Fallback to a fake Redis host on every request (Medium)

- **Where:** [redis.ts:7-10](apps/admin-web/src/lib/redis.ts#L7-L10)
- **Problem:** With no Upstash configured (dev, desktop, self-hosted), every cache call makes a network request to `https://fake.upstash.io`, waits for it to fail, then queries the database.
- **Fix:** If Redis is not configured, skip it (as `ratelimit.ts` already does) or use an in-memory LRU cache.

### C7 — Missing invalidations (Medium)

- **Problems:**
  - Marking attendance and saving marks do not invalidate `students:*`, so student profiles (`students:details:v5:*`, 1-hour TTL) show old attendance and results.
  - Teacher changes invalidate only the dashboard.
  - `cache:superadmin:*` is not cleared when schools are created.
- **Fix:** Invalidate the student cache on attendance and marks writes. Consider `revalidateTag` instead of hand-written key patterns.

### C8 — Students list silently capped at 1,000 (Medium)

- **Where:** [students/page.tsx:44](<apps/admin-web/src/app/(dashboard)/students/page.tsx#L44>)
- **Problem:** Search and filters run in the browser over at most 1,000 students. Larger schools cannot find the rest, although ENTERPRISE is sold as unlimited.
- **Fix:** Paginate and search on the server.

---

## 7. Performance

| ID  | Area                  | Location                                                                                            | Problem                                                                                                                                                                                                                    | Fix                                                                               |
| --- | --------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| P1  | School dashboard      | [dashboard/page.tsx:10-208](<apps/admin-web/src/app/(dashboard)/dashboard/page.tsx#L10-L208>)       | About 12 sequential queries. Pending fees are summed by loading every open fee item into JavaScript (tens of thousands of rows for a large school).                                                                        | `Promise.all`, plus SQL `aggregate`/`groupBy` or one raw SQL query.               |
| P2  | Ledger                | [ledger/page.tsx](<apps/admin-web/src/app/(dashboard)/ledger/page.tsx>)                             | Sends the school's entire history (all transactions, items, expenses, advances) to the browser with no pagination. Values over the Upstash size limit never cache, so every load hits the full database.                   | Server-side pagination, date-range filters, aggregate queries for the stat cards. |
| P3  | Super-admin dashboard | [super-admin.ts:113-143](apps/admin-web/src/lib/actions/super-admin.ts#L113-L143)                   | Loads every school, then queries plan limits once per school. Around 10 more sequential queries.                                                                                                                           | Load `PlanLimit` once and use a map. Run counts in parallel.                      |
| P4  | Section report cards  | [exams.ts:653-655](apps/admin-web/src/lib/actions/exams.ts#L653-L655)                               | Calls the single-card function per student: session lookup plus about 5 queries each.                                                                                                                                      | Fetch all marks and attendance for the section in a few queries.                  |
| P5  | Fee payment           | [fee-allocator.ts:163-430](apps/admin-web/src/lib/actions/fee-allocator.ts#L163-L430)               | Separate find and update per charge and per item inside a 30-second transaction, which holds locks longer.                                                                                                                 | Fetch all charges at once and batch updates.                                      |
| P6  | Monthly fee cron      | [cron/generate-fees/route.ts:58-96](apps/admin-web/src/app/api/cron/generate-fees/route.ts#L58-L96) | Every school and every class runs sequentially in one serverless call, each class in a transaction of up to 60 seconds. This will exceed function time limits as schools grow, leaving generation half done with no retry. | Process one school per job (queue or fan-out), and make it resumable.             |
| P7  | Admission numbers     | [admission-settings.ts:175-189](apps/admin-web/src/lib/actions/admission-settings.ts#L175-L189)     | Up to 100 sequential lookups per student.                                                                                                                                                                                  | Atomic counter (see D3).                                                          |
| P8  | Tab switching         | [use-query-state.ts:56-59](apps/admin-web/src/hooks/use-query-state.ts#L56-L59)                     | Each tab click calls both `history.replaceState` and `router.replace`. The router call refetches the page's server data every time.                                                                                        | Keep only `replaceState`.                                                         |
| P9  | Roll-number sorting   | `orderBy: { rollNumber: "asc" }` in several files                                                   | Roll numbers are strings, so they sort 1, 10, 11, 2.                                                                                                                                                                       | Store an integer sort column or sort numerically.                                 |
| P10 | Fees page             | [fees/page.tsx](<apps/admin-web/src/app/(dashboard)/fees/page.tsx>)                                 | Loads every active student with ledgers and transports, plus 100 charges with full student rows, on each render.                                                                                                           | Select only the fields the UI uses, and load per-student detail on demand.        |

---

## 8. Product and UX

### U1 — Pricing disagrees in four places (High)

| Where                                                                                                                                                                                                      | Plans and prices                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Landing page ([pricing-section.tsx](apps/admin-web/src/components/landing/pricing-section.tsx))                                                                                                            | Starter ₹1,999 / Growth ₹3,999 / Enterprise "Custom"       |
| Setup wizard ([setup/page.tsx:82-130](apps/admin-web/src/app/setup/page.tsx#L82-L130)) and payment order ([create-order/route.ts:16-20](apps/admin-web/src/app/api/payment/create-order/route.ts#L16-L20)) | Basic ₹999 / Pro ₹1,999 / Enterprise ₹4,999                |
| Super-admin revenue figures ([super-admin.ts:8-13](apps/admin-web/src/lib/actions/super-admin.ts#L8-L13)) and subscriptions page                                                                           | ₹999 / ₹2,499 / ₹4,999                                     |
| Enforced limits ([plan-limits.ts:11-16](apps/admin-web/src/lib/plan-limits.ts#L11-L16)) vs setup promises                                                                                                  | Basic 200 vs "500 students"; Pro 1,000 vs "2,000 students" |

A Pro school that paid for 2,000 students is blocked at 1,000. **Fix:** One plan catalogue module that every screen, the order route and the limit checks read from.

### U2 — Free trial advertised but not available (High)

- **Where:** [pricing-section.tsx:149](apps/admin-web/src/components/landing/pricing-section.tsx#L149), [faq-section.tsx:40-41](apps/admin-web/src/components/landing/faq-section.tsx#L40-L41), [school/create/route.ts:46-49](apps/admin-web/src/app/api/school/create/route.ts#L46-L49)
- **Problem:** The landing page and FAQ promise "14-day free trial, no credit card needed". Setup requires payment for every plan, and the server's TRIAL branch can never run because the payment fields are required.
- **Fix:** Build the trial path, or change the copy.

### U3 — Paid but no school (High)

- **Where:** [setup/page.tsx:382-410](apps/admin-web/src/app/setup/page.tsx#L382-L410)
- **Problem:** If school creation fails after Razorpay succeeds (subdomain taken in the meantime, server validation, network drop, tab closed), the user is charged and has no school. Retrying creates a new order and charges them again. Nothing is recorded for support to reconcile.
- **Fix:** Record the order and payment server-side. Let creation be retried with the same paid order. Re-check the subdomain right before opening checkout, and reserve it.

### U4 — Error messages (Medium)

- **Problems:**
  - Exam, timetable and student-import actions throw instead of returning errors. Next.js hides thrown messages in production, so users see a generic "An error occurred in the Server Components render".
  - Most other actions return `e.message` directly, so users see raw Prisma text such as "Unique constraint failed on the fields: (`receiptNo`)".
  - `updateTeacher` does not handle a duplicate email.
- **Fix:** Return `{ error }` consistently. Map known Prisma codes (P2002, P2003, P2025) to friendly messages and log the rest.

### U5 — Email configuration mismatch (Medium)

- **Where:** [send-otp/route.ts:63](apps/admin-web/src/app/api/auth/send-otp/route.ts#L63), [mailer.ts:9-14](apps/admin-web/src/lib/mailer.ts#L9-L14), [.github/workflows/ci.yml](.github/workflows/ci.yml)
- **Problem:** The OTP route accepts `SMTP_PASS` or `SMTP_PASSWORD`. The mailer (password reset, salary slips) requires `SMTP_PASSWORD`. CI sets `SMTP_PASS`. A deployment can send OTPs while password reset and salary emails fail. The OTP route also builds its own transport instead of using the shared mailer.
- **Fix:** One variable name and one mailer.

### U6 — Setup stores inconsistent data (Medium)

- **Where:** [setup/page.tsx:220-226](apps/admin-web/src/app/setup/page.tsx#L220-L226), [onboarding.ts:152-171](apps/admin-web/src/lib/onboarding.ts#L152-L171)
- **Problems:**
  - Time zone is saved as `"Asia/Kolkata (IST)"`, which is not a valid time-zone name.
  - The grading system is saved as free text ("Percentage (0 - 100)") with no link to `Exam.gradingSystem`.
  - Setup numbers classes by position (Nursery=1, LKG=2, UKG=3, Class 1=4), while [class-catalog.ts](apps/admin-web/src/lib/class-catalog.ts) uses Nursery=-2, LKG=-1, UKG=0, Grade N=N.
  - Setup names classes "Class 1" while the class catalogue uses "Grade 1", so the duplicate check misses them and schools end up with both.
  - The setup form's default email can be empty if the session has not loaded yet.
  - Seeding errors are logged and swallowed, so a school can start with no classes or session and the user is not told.
- **Fix:** Store IANA time zones. Use the class catalogue in setup. Surface seeding failures and offer to retry.

### U7 — Attendance has no "not marked" state (Medium)

- **Where:** [attendance-content.tsx:180-185](apps/admin-web/src/components/attendance/attendance-content.tsx#L180-L185), [attendance-taker.tsx:23-33](apps/teacher-pwa/src/components/attendance/attendance-taker.tsx#L23-L33)
- **Problem:** Every student defaults to Present, so an accidental Save marks absent students present, and the screen cannot show whether a day was ever taken. In the PWA, the progress bar shows 100% before anything is tapped.
- **Fix:** Show an unmarked state, and display whether attendance has been saved for the selected day.

### U8 — Teacher PWA gaps (Medium)

- **Where:** [teacher-pwa/src/app/attendance/take/page.tsx:25](apps/teacher-pwa/src/app/attendance/take/page.tsx#L25), [teacher-pwa/src/app/students/page.tsx:15-17](apps/teacher-pwa/src/app/students/page.tsx#L15-L17), [teacher-pwa/next.config.ts](apps/teacher-pwa/next.config.ts)
- **Problems:**
  - It only uses the legacy single `assignedClassId`/`assignedSectionId`. Teachers with several sections, or class teachers without a legacy assignment, cannot take attendance.
  - The PWA attendance API rejects anything that is not the legacy assignment.
  - There is no service worker, although the README advertises offline support.
  - A failed submit loses the marks; there is no queue or retry.
  - The students page shows fee status from the legacy `fees` table, which is never updated.
  - Its request handlers do not catch validation errors, so bad input returns a 500.
- **Fix:** Use `TeacherSection` assignments, add an offline queue for attendance, and read fee status from `FeeCharge`.

### U9 — Report-card attendance covers only the exam window (Low)

- **Where:** [exams.ts:575-595](apps/admin-web/src/lib/actions/exams.ts#L575-L595)
- **Problem:** Attendance is counted only between the exam's start and end dates (often one week) and shows 100% when there are no records. Use the term or session range.

### U10 — Fee preview can differ from what is saved (Low)

- **Where:** [collection-tab.tsx:486-510](apps/admin-web/src/components/fees/tabs/collection-tab.tsx#L486-L510)
- **Problem:** The preview shows a per-item split from `itemPayments`, but the server ignores it and allocates across items in order.

### U11 — Duplicate fee collection screens (Low)

- **Where:** [collection-tab.tsx](apps/admin-web/src/components/fees/tabs/collection-tab.tsx) (1,774 lines), [student-fee-collection.tsx](apps/admin-web/src/components/students/student-fee-collection.tsx) (1,392 lines)
- **Problem:** Two near-copies of the same payment flow and policy checks. Fixes to one will drift from the other.
- **Fix:** Extract a shared hook and component.

### U12 — Inconsistent confirmations (Low)

- **Problem:** Some deletes use the browser's built-in `confirm()` (transport, exams); others use the app's `ConfirmDialog`. Destructive messages understate the impact (D1).

### U13 — Validation limits too strict or too loose (Low)

- **Problems:**
  - Registration caps names at 20 characters, which rejects many full names ([register/route.ts:17](apps/admin-web/src/app/api/auth/register/route.ts#L17)).
  - Minimum password length is 6.
  - A teacher salary of 0 is stored as `null`.
  - Attendance accepts future dates on the server.
  - Expenses only allow 4 of the 11 payment methods.

### U14 — Gemini fallback message is misleading (Low)

- **Where:** [timetable.ts:564-608](apps/admin-web/src/lib/actions/timetable.ts#L564-L608)
- **Problem:** Any Gemini failure, including a missing API key, is reported as "Gemini AI was busy". Teacher names and schedules are sent to a third-party API; consider stating this in the privacy policy.

---

## 9. Other notes

- **Clickjacking on public pages.** `X-Frame-Options` is set in [middleware.ts:78-83](apps/admin-web/src/middleware.ts#L78-L83) only for authenticated routes. `/login` and `/register` can be framed. There is no Content-Security-Policy. Move these headers into `next.config.js` `headers()` for all routes.
- **Server Actions `allowedOrigins`.** [next.config.js](apps/admin-web/next.config.js) passes `NEXT_PUBLIC_APP_URL` (a full URL with `https://`), but Next.js expects host names. This only matters behind a proxy whose origin differs from the host.
- **Desktop app external-link check.** [apps/desktop/src/main.ts:143-151](apps/desktop/src/main.ts#L143-L151) allows any URL that starts with `BASE_URL` (`https://kora-admin-web.vercel.app`). `https://kora-admin-web.vercel.app.example.com` also passes and opens inside the app window. Compare parsed origins instead. Navigation inside the window (`will-navigate`) is not restricted.
- **Client IP trust.** [ip.ts](apps/admin-web/src/lib/ip.ts) trusts the first `X-Forwarded-For` value. That is fine on Vercel, but spoofable when self-hosted or in the desktop build, which weakens IP rate limits.
- **In-memory rate limits.** When Upstash is not configured, rate limits are per serverless instance and reset on cold start, so they do not protect a deployed app.
- **Upload endpoint.** [api/upload/route.ts](apps/admin-web/src/app/api/upload/route.ts) reads the whole file into memory with no size limit and no rate limit.
- **Stray files in the repo.** `apps/admin-web/test-zod.ts`, `test-zod2.ts`, `test-zod3.ts`, `apps/admin-web/update_dialog.patch`, plus the `check-password` files (S2).
- **`env.ts` is out of date.** [env.ts](apps/admin-web/src/env.ts) validates `NEXTAUTH_SECRET` but not `AUTH_SECRET`, `RAZORPAY_*`, `CRON_SECRET`, SMTP or Upstash. Missing secrets fail silently at runtime (see S4, S6, U5).
- **README is out of date.** It lists the exam and timetable modules as "Coming in V2", says the PWA is offline-ready, and tells developers to use `db push` (see D14).

---

## 10. Suggested fix order

### Today

1. Rotate the Neon password; remove `.env.test` and both `check-password` files; purge them from git history (S1, S2).
2. Change the leaked account's password (S2).
3. Delete every `admin.*@schoolos.com` user in production and remove the seed code (S3).
4. Bind Razorpay orders to plans server-side, record used payment IDs, and remove the dummy-secret fallback (S4).
5. Confirm `CRON_SECRET` is set in Vercel and make the cron routes fail closed (S6).
6. Turn off automatic monthly fee generation until B1 and B2 are fixed, and audit already-generated charges for overbilling.

### This week

1. One shared session guard (role, user active, school active) and a tenant-ownership helper on every action (section 2, A1–A5).
2. Fee generation: respect frequency, select the structure by session, and add a period key with a unique constraint (B1–B3).
3. Payments: input validation, row locking with increments, per-school sequential receipt numbers, idempotency key (B4–B7).
4. Transport routes: update stops in place and change the cascade to restrict (D1).
5. Attendance date-change bug (D2).
6. Cache key collisions and the transport role cache (C1, C3).

### Next

1. Baseline migrations and switch CI to `migrate deploy` (D14).
2. Provider point-in-time recovery for disaster recovery (D15).
3. Admission number and roll number constraints, plus the import fixes (D3–D6).
4. Timetable period and slot fixes (D7–D9), marks validation and locking (D11), grading pass marks (D12).
5. Session re-validation and login rate limiting (A6, A7).
6. Single plan catalogue, trial path or copy change, payment recovery flow (U1–U3).
7. Dashboard, ledger and cron performance (P1–P6).
