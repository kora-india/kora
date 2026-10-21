# Kora — Multi-Tenant School Management SaaS

A production-ready, premium School Management Platform built with **Next.js 15**, **TypeScript**, **Turborepo**, **Prisma**, and **Auth.js v5**.

---

## 🏗️ Architecture

```
schoolos/
├── apps/
│   ├── admin-web       → Admin Dashboard (port 3000)
│   ├── teacher-pwa     → Mobile Teacher PWA (port 3001)
│   └── desktop         → Electron wrapper for the admin dashboard
└── packages/
    ├── ui              → Shared UI components
    ├── db              → Prisma ORM + seed data
    ├── auth            → Auth.js v5 + RBAC
    ├── types           → Zod schemas + TypeScript types
    ├── utils           → Shared utilities
    ├── logger          → Structured logging (pino)
    └── config          → TSConfig + Tailwind base
```

---

## 🚀 Quick Start

### 1. Prerequisites

- Node.js ≥ 18
- pnpm ≥ 9
- PostgreSQL running locally

### 2. Install dependencies

```bash
pnpm install
```

### 3. Environment setup

```bash
cp .env.example .env
# Set DATABASE_URL and AUTH_SECRET (32+ characters) to start.
```

When the server starts it lists any other settings that are missing and what
won't work without them (payments, email, scheduled fee jobs, Redis, uploads).

### 4. Database setup

```bash
pnpm db:generate    # Generate Prisma client
pnpm db:deploy      # Apply the migrations
pnpm db:seed        # Seed with demo data
```

To change the schema, edit `schema.prisma` and run `pnpm db:migrate` against
your **local** database; it creates a migration to commit. Deployments run
`pnpm db:deploy`. Don't use `db push` on a shared or production database: it
skips the migrations' data fixes and can drop data.

### 5. Run development

```bash
pnpm dev
```

This starts both apps:

- Admin Dashboard: http://localhost:3000
- Teacher PWA: http://localhost:3001

---

## 🧩 What's included

- Students, staff and teachers, with spreadsheet import
- Daily attendance (admin dashboard and Teacher PWA)
- Fees: structures, monthly generation, collection, receipts, late fees, advances
- Transaction ledger and expenses
- Transport routes, stops and bus fees
- Exams, marks entry and report cards
- Timetable, with conflict checks and optional AI scheduling
- Payroll and salary slips
- Notices and homework
- Plans, a 14-day free trial and online billing

---

## 🔐 Demo Credentials

| Role         | Email                       | Password      |
| ------------ | --------------------------- | ------------- |
| Super Admin  | superadmin@schoolos.com     | superadmin123 |
| School Admin | admin@dps.schoolos.com      | admin123      |
| Teacher      | priya.nair@dps.schoolos.com | teacher123    |
| Accountant   | accounts@dps.schoolos.com   | accountant123 |

---

## 📱 Teacher PWA Features

The Teacher PWA is a mobile-first Progressive Web App designed for:

- ✅ **Fast attendance** — Mark attendance in < 20 seconds
- ✅ **Bottom navigation** — Native app feel
- ✅ **Works offline** — a service worker keeps the app openable without a connection, and attendance saved offline is queued on the phone and sent when it reconnects
- ✅ **Installable** — Add to home screen on Android/iOS
- ✅ **Class-scoped** — Teachers see the sections they're assigned or are class teacher of

### Install as PWA

1. Open http://localhost:3001 on your phone
2. Tap "Add to Home Screen" in the browser menu
3. Launch like a native app!

---

## 🎨 Design System

- **Colors**: Violet primary (`#7c3aed`), semantic status colors
- **Typography**: Geist Sans + Geist Mono
- **Dark Mode**: Full dark/light theme support
- **Animations**: Framer Motion for smooth transitions
- **Components**: Built on Radix UI primitives

---

## 📦 Tech Stack

| Layer          | Technology                  |
| -------------- | --------------------------- |
| Framework      | Next.js 15 (App Router)     |
| Language       | TypeScript 5                |
| Styling        | Tailwind CSS + CVA          |
| Animations     | Framer Motion               |
| Database ORM   | Prisma 5 + PostgreSQL       |
| Authentication | Auth.js v5 (NextAuth)       |
| Monorepo       | Turborepo + pnpm workspaces |
| Charts         | Recharts                    |
| Forms          | React Hook Form + Zod       |
| UI Primitives  | Radix UI                    |
| Icons          | Lucide React                |

---

## 🏫 Multi-tenancy

Every database model includes `schoolId` for tenant isolation:

```typescript
// All queries automatically scoped:
await prisma.student.findMany({ where: { schoolId: user.schoolId } });
await prisma.attendance.findMany({ where: { schoolId: user.schoolId } });
```

---

## 🛡️ RBAC

| Permission      | Super Admin | School Admin | Teacher | Accountant |
| --------------- | :---------: | :----------: | :-----: | :--------: |
| Manage schools  |     ✅      |      ❌      |   ❌    |     ❌     |
| Manage students |     ✅      |      ✅      |   ❌    |     ❌     |
| Take attendance |     ✅      |      ✅      |   ✅    |     ❌     |
| View fees       |     ✅      |      ✅      |   ✅    |     ✅     |
| Edit fees       |     ✅      |      ✅      |   ❌    |     ✅     |
| Publish notices |     ✅      |      ✅      |   ✅    |     ❌     |
| View analytics  |     ✅      |      ✅      |   ❌    |     ✅     |

---

## 📁 Extending SchoolOS

### Add a new module

1. Add Prisma model in `packages/db/prisma/schema.prisma`
2. Add Zod types in `packages/types/src/`
3. Create API route in `apps/admin-web/src/app/api/`
4. Build page in `apps/admin-web/src/app/(dashboard)/`

### Add a new role

1. Add to `UserRole` enum in schema + types
2. Update `ROLE_PERMISSIONS` in `packages/auth/src/middleware.ts`
3. Update nav items in `apps/admin-web/src/components/layout/sidebar.tsx`

---

## 🧪 Coming in V2

- [ ] Parent portal
- [ ] SMS/Email notifications
- [ ] Biometric attendance integration
- [ ] Custom report builder
- [ ] Library management

---

Built with ❤️ using SchoolOS — the premium school management platform.
