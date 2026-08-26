# SchoolOS — Project Documentation & Status

This document provides a comprehensive overview of the current state of **SchoolOS**, detailing the implemented architecture, developed modules, and the future scope for the platform.

---

## 🏗️ 1. System Architecture

SchoolOS is built as a highly scalable, multi-tenant SaaS application using a modern Turborepo monorepo structure.

### Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript 5
- **Database ORM:** Prisma 5 + PostgreSQL
- **Authentication:** Auth.js v5 (NextAuth)
- **Styling:** Tailwind CSS + Radix UI Primitives + Framer Motion
- **Tooling:** pnpm workspaces

### Repository Structure
- **`apps/admin-web`**: The main administrative dashboard for super admins, school admins, and accountants.
- **`apps/teacher-pwa`**: A mobile-first Progressive Web App designed specifically for teachers to manage day-to-day classroom activities.
- **`packages/db`**: Centralized database schemas, Prisma client generation, and seed scripts.
- **`packages/auth`**: Shared authentication logic, middleware, and Role-Based Access Control (RBAC).
- **`packages/ui`**: Shared UI components and design system tokens.
- **`packages/types`**: Shared Zod schemas and TypeScript type definitions.

---

## ✅ 2. What Has Been Implemented (Current State)

The core foundation of the multi-tenant school management platform is fully operational, encompassing several critical modules:

### 🏢 Core Multi-Tenancy & Subscriptions
- **School Management:** Support for multiple schools within the same database, logically separated by `schoolId`.
- **Subscription Plans:** Built-in support for different tiers (FREE, BASIC, PRO, ENTERPRISE) with enforcement on limits (`plan_limits` like max students/teachers).
- **Academic Sessions:** Ability to manage multiple academic years and assign structures to specific sessions.

### 🔐 Authentication & RBAC
- **NextAuth Integration:** Secure, credential-based authentication using hashed passwords (bcrypt).
- **Role-Based Access Control:** Four distinct roles: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, and `ACCOUNTANT`.
- **Role Scoping:** Strict data access rules ensuring users only see data pertaining to their assigned school and allowed role.

### 👥 People Management
- **Users:** Unified user account model.
- **Teachers:** Detailed teacher profiles mapped to user accounts, with subject specialization and class/section assignments.
- **Students:** Comprehensive student records including admission numbers, parent details, DOB, and active status.

### 🏫 Academics & Classrooms
- **Classes & Sections:** Hierarchical structure grouping students into specific classes and sections.
- **Assignments:** Teachers can create assignments with due dates and descriptions, targeted at specific classes/sections.

### 📅 Operations
- **Attendance Management:** Robust attendance tracking (Present, Absent, Late, Excused) recorded by date, student, and marked by a specific user.
- **Notices/Announcements:** System for publishing notices with varying priorities (LOW, MEDIUM, HIGH) and targeted visibility.

### 💰 Comprehensive Fee & Finance Module
- **Fee Components & Structures:** Granular fee creation (monthly, quarterly, yearly, one-time) and grouping into reusable structures.
- **Student Assignments & Overrides:** Assigning fee structures to students, with the ability to provide specific discounts or exemptions.
- **Billing & Charges:** Generation of fee charges and charge items.
- **Payments & Ledgers:** Processing of payments (Cash, UPI, Bank Transfer, etc.), generation of receipts, payment allocations to specific fee items, and tracking of advance payments (Ledger).

### 📱 Applications
**Admin Dashboard (`admin-web`)**
Fully functional dashboard routes for managing:
- Analytics
- Schools (Super Admin only)
- Students & Teachers
- Classes
- Fees & Finances
- Attendance & Notices
- Settings

**Teacher PWA (`teacher-pwa`)**
Mobile-optimized experience featuring:
- Fast attendance marking
- Assignment creation and tracking
- Notice board viewing
- Student directory access

---

## 🏭 3. Production Readiness

SchoolOS today is architected as a **modular monolith** (a Turborepo monorepo with shared packages and a single Postgres database), not microservices — appropriate for its current stage, but the assessment below covers how close the system is to being production-grade.

### Architecture Classification
- **Type:** Modular monolith (multiple Next.js apps — `admin-web`, `teacher-pwa`, `marketing` — sharing one database via `packages/db` and one auth layer via `packages/auth`).
- **Not microservices:** all domains (Students, Fees, Payments, Attendance, etc.) live in one Prisma schema (28 models) and are accessed via direct DB calls / Server Actions, not internal service APIs.
- Splitting into true microservices would be a large effort (roughly 8–12 weeks for one engineer), mainly due to breaking apart the tightly-related Fee/Payment/Ledger data model, introducing an inter-service communication layer, and handling distributed transactions that are currently single DB transactions. Not recommended until there's a concrete scaling or team-ownership reason to do so — a tighter modular monolith (enforced domain boundaries inside `packages/`) gets most of the benefit at a fraction of the cost.

### ✅ Already in place
- **Error Tracking & Observability:** Sentry Next.js SDK integrated (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`) with client crash monitoring and error boundaries (`(dashboard)/error.tsx`, `global-error.tsx`).
- **Structured JSON Logging:** `@schoolos/logger` package powered by `pino` with pretty terminal output in development, JSON output with tenant metadata in production, and automatic sensitive field redaction (`password`, `token`, `otp`).
- **Database & Cache Instrumentation:** Prisma slow query detection (>200ms) and resilient Upstash Redis logging.
- **Health check endpoint with DB latency check:** (`/api/health`)
- **Cron endpoints:** (`/api/cron/generate-fees`, `/api/cron/apply-late-fees`) protected by a `CRON_SECRET` bearer token with structured audit trails
- **Zod schema validation:** (`packages/types`) and NextAuth v5 for authentication
- **Prisma for typed, injection-safe DB access:** Sensible, normalized domain modeling across 28 tables
- **Environment security:** `.env` correctly gitignored — no secrets committed to the repo

### ⚠️ Gaps to close before calling this production-grade
1. **No automated tests** — no `.test.ts`/`.spec.ts` files anywhere in the repo. No safety net for regressions, especially in the fee/payment logic, which is the highest-risk domain.
2. **No CI/CD pipeline** — no `.github/workflows`; nothing gates merges on lint, type-check, or tests. Deploys rely solely on the Vercel build succeeding.
3. **No rate limiting** — auth, OTP, and payment endpoints have no throttling and are open to brute-force/abuse.
4. **Schema managed via `prisma db push`, not migrations** — no `packages/db/prisma/migrations` folder exists. `db push` is fine for prototyping but is destructive/unsafe for a live production database (no migration history, no safe rollback path). `DEPLOYMENT.md` itself flags this as a recommended-but-not-yet-done step.
5. **Cron auth fails open** — if `CRON_SECRET` is unset, the cron routes log a warning but still execute unauthenticated. Safe default should be to reject the request when the secret is missing in a production environment.
6. **N+1 / sequential loops in cron jobs** — `generate-fees` and `apply-late-fees` iterate schools → classes → charges one at a time with individually-awaited queries. Will slow down and risk timeouts as the number of schools grows.
7. **No documented retry/idempotency handling** around payment gateway calls — payment creation/webhooks typically need idempotency keys to avoid double-charging on retries.
8. **No documented backup/DR strategy** — single database, single region, with no backup or disaster-recovery process written down.

### Recommended order of work
1. Switch to Prisma migrations for schema changes (`prisma migrate dev` / `migrate deploy`).
2. Add a CI pipeline (lint + type-check + tests) gating merges to `master`.
3. Add rate limiting to auth/OTP/payment endpoints.
4. Add automated tests for the Fee/Payment/Ledger module first, since it's the highest-risk domain.
5. Harden cron auth to fail closed, and batch/parallelize the cron job queries.
6. Document a backup/DR strategy and add idempotency handling to payment flows.

---

## 🚀 4. Future Scope (V2 & Beyond)

While the core functionality is robust, several modules are planned for future development to make SchoolOS a complete end-to-end educational ecosystem:

### Academics & Assessment
- **Exam & Gradebook Module:** Creation of exams, grading structures, automatic report card generation, and performance analytics.
- **Timetable Generator:** Automated or manual scheduling of classes, teacher assignments, and conflict resolution.
- **Library Management:** Tracking of physical/digital books, issuance, returns, and late fee calculations.

### Communication & Engagement
- **Parent Portal / App:** A dedicated interface for parents to view their child's attendance, pay fees online, view grades, and communicate with teachers.
- **SMS & Email Notifications:** Automated alerts for fee dues, absent students, important notices, and exam results.

### Advanced Operations
- **Biometric Attendance Integration:** Connecting physical biometric/RFID scanners to the attendance module for automatic logging.
- **Custom Report Builder:** A drag-and-drop interface for admins to generate custom data exports and analytical reports.
- **Transport Management:** Managing bus routes, vehicle tracking, and transport fee allocation.
- **Inventory & Asset Management:** Tracking school physical assets, stationary, and purchase orders.

---

*This document is intended to be a living document and should be updated as new features are merged into the main branch.*
