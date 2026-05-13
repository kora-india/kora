# SchoolOS — Deployment Guide

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend / API | Next.js 15 (App Router) on **Vercel** |
| Database | PostgreSQL on **Neon** or **Supabase** |
| Auth | NextAuth v5 (JWT, credentials) |
| ORM | Prisma 5 |
| Monorepo | Turborepo + pnpm |

---

## 1. Prerequisites

- Node.js ≥ 18
- pnpm ≥ 9 (`npm i -g pnpm`)
- A PostgreSQL database (Neon free tier works)

---

## 2. Environment Variables

Copy the example and fill in real values:

```bash
cp .env.example .env
```

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Full PostgreSQL connection string. Add `?sslmode=require` for Neon/Supabase |
| `NEXTAUTH_SECRET` | ✅ | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | Your production URL, e.g. `https://schoolos.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Same as `NEXTAUTH_URL` |

---

## 3. Database Setup

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Push schema to database (first deploy)
pnpm db:push

# OR use migrations (recommended for production)
cd packages/db && pnpm prisma migrate deploy

# Seed demo data
pnpm db:seed
```

> **Note:** After adding the `Subscription` and `PlanLimit` models, run `pnpm db:push` or create a migration before deploying.

### Seed plan limits (run once after first deploy)

```bash
# In packages/db, run this snippet via prisma studio or a one-off script:
# FREE: 50 students / 5 teachers / 5 classes
# BASIC: 200 / 20 / 20
# PRO: 1000 / 100 / 60
# ENTERPRISE: unlimited
```

---

## 4. Deploy to Vercel

### Option A — Vercel CLI

```bash
npm i -g vercel
vercel --cwd apps/admin-web
```

Set environment variables in the Vercel dashboard under **Project → Settings → Environment Variables**.

### Option B — GitHub Integration

1. Push to GitHub
2. Import repo in [vercel.com/new](https://vercel.com/new)
3. Set **Root Directory** to `apps/admin-web`
4. Add all environment variables
5. Deploy

### Vercel Build Settings

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Root Directory | `apps/admin-web` |
| Build Command | `cd ../.. && pnpm build --filter=@schoolos/admin-web` |
| Install Command | `pnpm install` |

---

## 5. Neon Database Setup

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the **connection string** (Pooled connection for production)
3. Add `?sslmode=require` if not already present
4. Set as `DATABASE_URL` in Vercel environment variables

---

## 6. Post-Deploy Steps

```bash
# 1. Run migrations on production DB
cd packages/db && DATABASE_URL="<prod-url>" pnpm prisma migrate deploy

# 2. Seed demo data (optional — only for demo environments)
DATABASE_URL="<prod-url>" pnpm db:seed

# 3. Verify health check
curl https://your-domain.com/api/health
```

Expected health check response:
```json
{
  "status": "ok",
  "database": { "status": "connected", "latencyMs": 12 }
}
```

---

## 7. First School Onboarding

1. Login as **Super Admin**: `super@schoolos.com`
2. Navigate to **Schools → Add School**
3. Fill school name, subdomain, admin email
4. Check "Seed default classes" for a quick start
5. Copy the generated temporary password
6. Share credentials with the school admin
7. School admin logs in and changes their password

---

## 8. Demo Credentials (after seed)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | super@schoolos.com | admin123 |
| School Admin | admin@dps.edu.in | admin123 |
| Teacher | priya@dps.edu.in | teacher123 |
| Accountant | accounts@dps.edu.in | accounts123 |

---

## 9. Resetting Demo Data

```bash
# Drop and re-seed (destructive!)
cd packages/db
pnpm prisma migrate reset --force
pnpm seed
```

---

## 10. Common Issues

| Issue | Fix |
|-------|-----|
| `NEXTAUTH_URL` mismatch | Must exactly match your deployment URL including protocol |
| Prisma client not generated | Run `pnpm db:generate` before build |
| Build fails in monorepo | Ensure `Root Directory` is set to `apps/admin-web` in Vercel |
| Database SSL error | Add `?sslmode=require` to `DATABASE_URL` |
| `NEXTAUTH_SECRET` too short | Must be at least 32 characters |
