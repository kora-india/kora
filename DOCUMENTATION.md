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

## 🚀 3. Future Scope (V2 & Beyond)

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
