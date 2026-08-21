# SchoolOS — Multi-Tenant School Management SaaS

A production-ready, premium School Management Platform built with **Next.js 15**, **TypeScript**, **Turborepo**, **Prisma**, and **Auth.js v5**.

---

## 🏗️ Architecture

```
schoolos/
├── apps/
│   ├── admin-web       → Admin Dashboard (port 3000)
│   └── teacher-pwa     → Mobile Teacher PWA (port 3001)
└── packages/
    ├── ui              → Shared UI components
    ├── db              → Prisma ORM + seed data
    ├── auth            → Auth.js v5 + RBAC
    ├── types           → Zod schemas + TypeScript types
    ├── utils           → Shared utilities
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
# Edit .env with your DATABASE_URL and NEXTAUTH_SECRET
```

### 4. Database setup

```bash
pnpm db:generate    # Generate Prisma client
pnpm db:push        # Push schema to database
pnpm db:seed        # Seed with demo data
```

### 5. Run development

```bash
pnpm dev
```

This starts both apps:
- Admin Dashboard: http://localhost:3000
- Teacher PWA: http://localhost:3001

---

## 🔐 Demo Credentials

| Role         | Email                       | Password      |
|--------------|-----------------------------|---------------|
| Super Admin  | superadmin@schoolos.com     | superadmin123 |
| School Admin | admin@dps.schoolos.com      | admin123      |
| Teacher      | priya.nair@dps.schoolos.com | teacher123    |
| Accountant   | accounts@dps.schoolos.com   | accountant123 |

---

## 📱 Teacher PWA Features

The Teacher PWA is a mobile-first Progressive Web App designed for:

- ✅ **Fast attendance** — Mark attendance in < 20 seconds
- ✅ **Bottom navigation** — Native app feel
- ✅ **Offline-ready structure** — Service worker via Next.js
- ✅ **Installable** — Add to home screen on Android/iOS
- ✅ **Class-scoped** — Teachers only see their assigned class

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

| Layer          | Technology                         |
|----------------|------------------------------------|
| Framework      | Next.js 15 (App Router)            |
| Language       | TypeScript 5                       |
| Styling        | Tailwind CSS + CVA                 |
| Animations     | Framer Motion                      |
| Database ORM   | Prisma 5 + PostgreSQL              |
| Authentication | Auth.js v5 (NextAuth)              |
| Monorepo       | Turborepo + pnpm workspaces        |
| Charts         | Recharts                           |
| Forms          | React Hook Form + Zod              |
| UI Primitives  | Radix UI                           |
| Icons          | Lucide React                       |

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

| Permission         | Super Admin | School Admin | Teacher | Accountant |
|--------------------|:-----------:|:------------:|:-------:|:----------:|
| Manage schools     | ✅          | ❌           | ❌      | ❌         |
| Manage students    | ✅          | ✅           | ❌      | ❌         |
| Take attendance    | ✅          | ✅           | ✅      | ❌         |
| View fees          | ✅          | ✅           | ✅      | ✅         |
| Edit fees          | ✅          | ✅           | ❌      | ✅         |
| Publish notices    | ✅          | ✅           | ✅      | ❌         |
| View analytics     | ✅          | ✅           | ❌      | ✅         |

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

- [ ] Exam & gradebook module
- [ ] Parent portal
- [ ] SMS/Email notifications
- [ ] Biometric attendance integration
- [ ] Custom report builder
- [ ] Timetable generator
- [ ] Library management

---

Built with ❤️ using SchoolOS — the premium school management platform.
