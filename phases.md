# SchoolOS — Path to Production-Ready

This is a gap analysis against the current codebase (not a wishlist). Each phase is
gated on the one before it — don't start Phase 2 with Phase 1 unresolved. Phases are
ordered by risk: things that lose data, leak tenants, or lock out customers come
first; polish comes last.

**Baseline already in place:** RBAC + school-scoped queries ([middleware.ts](apps/admin-web/src/middleware.ts), [packages/auth/src/index.ts](packages/auth/src/index.ts)), Vercel/Neon deploy path ([DEPLOYMENT.md](DEPLOYMENT.md)), a manual pre-deploy checklist ([DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)), password reset over SMTP ([mailer.ts](apps/admin-web/src/lib/mailer.ts)), structured console logging ([logger.ts](apps/admin-web/src/lib/logger.ts)), and a `/api/health` DB check.

---

## Phase 1 — Auth & security hardening (blocking)

The credentials provider ([packages/auth/src/index.ts](packages/auth/src/index.ts)) has no
throttling: any endpoint that checks a password can be brute-forced today.

- [ ] Rate-limit `authorize()` and `/api/auth/*` — per-IP and per-email backoff (Upstash Redis or a Postgres-backed counter; monorepo has no Redis dependency yet)
- [ ] Rate-limit password-reset request ([password-reset.ts](apps/admin-web/src/lib/actions/password-reset.ts)) to stop email-bombing a target address
- [ ] Add `Content-Security-Policy` and `Strict-Transport-Security` headers — [middleware.ts](apps/admin-web/src/middleware.ts) currently sets only `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- [ ] Enforce a real password policy on signup/reset (length + breach-list check via zod refinement) — currently no minimum beyond form-level validation
- [ ] Add account lockout or CAPTCHA after N failed logins
- [ ] Rotate `NEXTAUTH_SECRET` for prod separately from `.env` (confirm it isn't reused from the dev value committed nowhere, but never assume — audit Vercel env vars directly)
- [ ] Session hardening: shorten JWT `maxAge`, add idle timeout, confirm `secure`/`httpOnly` cookie flags under `trustHost: true`
- [ ] Add an audit log table (who suspended a school, who edited a fee, who reset whose password) — no such table exists in [schema.prisma](packages/db/prisma/schema.prisma) today

## Phase 2 — Data integrity & multi-tenancy backstop (blocking)

Tenant isolation is enforced entirely in application code (`where: { schoolId }` on
every query). One missed `where` clause anywhere is a cross-tenant data leak.

- [ ] Add Postgres Row-Level Security policies keyed on `schoolId` as a defense-in-depth backstop, not just app-layer filtering
- [ ] Add an integration test suite that asserts School A can never read/write School B's rows, for every model that carries `schoolId` (Student, Teacher, Fee, Attendance, Notice, Assignment, Payment, Class, Section)
- [ ] Switch `db:push` to real Prisma migrations for prod (`prisma migrate deploy` is already documented in [DEPLOYMENT.md](DEPLOYMENT.md) as an "OR" — make it the only path, drop `db push` for anything but local dev)
- [ ] Document and test a backup/restore runbook for the Neon/Supabase Postgres instance (point-in-time restore verified at least once, not just assumed available)
- [ ] Add DB-level cascade/constraint review — confirm soft-delete (`isActive: false`) is honored consistently across Student, Teacher, and every list query that reads them (README documents soft-delete for students; verify the same holds for teachers and classes)

## Phase 3 — Automated testing & CI/CD (blocking)

There are currently zero test files in the repo and no `.github/workflows` — every
release goes out on the manual 200-item checklist in
[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) alone.

- [ ] Add a test runner (Vitest recommended — fastest fit for the existing TS/Turborepo setup) to root `package.json` and each app
- [ ] Unit tests for RBAC (`ROLE_PERMISSIONS` in [middleware.ts](packages/auth/src/middleware.ts)) and plan-limit enforcement
- [ ] Integration tests for the server actions in `apps/admin-web/src/lib/actions/*` (fees, students, teachers, schools, password-reset) — these currently have no test coverage and are where money and PII logic lives
- [ ] E2E smoke test (Playwright) covering: login for all 4 roles, add/edit/delete student, mark attendance, create+pay a fee, suspend a school — i.e. automate the checklist's "Core Features" section instead of running it by hand every deploy
- [ ] GitHub Actions workflow: `pnpm install && pnpm lint && pnpm type-check && pnpm test && pnpm build` on every PR, blocking merge on failure
- [ ] Wire `prisma migrate deploy` into the deploy pipeline instead of a manual step
- [ ] Add a staging environment (separate Vercel project + Neon branch) so migrations and the E2E suite run before prod

## Phase 4 — Observability & incident response

[logger.ts](apps/admin-web/src/lib/logger.ts) writes structured JSON to stdout but
nothing aggregates, alerts on, or retains it beyond Vercel's default log window.

- [ ] Add error tracking (Sentry) wired into both server actions and the client — currently a thrown error in a server action just becomes a console line
- [ ] Add uptime + latency alerting on `/api/health` (it exists and returns DB latency, but nothing polls it)
- [ ] Add alerting on failed email sends (`sendMail` in [mailer.ts](apps/admin-web/src/lib/mailer.ts) already returns `{ success: false }` on failure — nothing currently reads that outside the immediate caller)
- [ ] Define on-call/escalation for production incidents (who gets paged, runbook location)
- [ ] Add basic product analytics/usage tracking if the business needs adoption metrics (currently none)

## Phase 5 — Fees & payments completion

The Fee model supports `Mark Paid` / `Mark Overdue` as manual admin actions
([fees-content.tsx](apps/admin-web/src/components/fees/fees-content.tsx)) — there's
no payment gateway, so "PAID" today means "an admin clicked a button," not "money
moved."

- [ ] Decide scope: is online payment collection (Razorpay/Stripe) in v1, or is manual reconciliation the intended product? If online payment, this phase blocks launch; if not, relabel this phase as post-launch and skip.
- [ ] If in scope: integrate a payment gateway with webhook-verified confirmation (never trust a client-side "payment succeeded" callback), idempotency keys on the `Payment` model, and a reconciliation job
- [ ] Generate a receipt/invoice PDF per payment and email it (mailer infra already exists)
- [ ] Add fee reminder emails/notifications for PENDING/OVERDUE fees — currently there's no automated nudge, only manual status changes
- [ ] The recent commit `bf9208d` removed fee configuration/structure entirely — confirm that was intentional and not a regression before building payments on top of what remains

## Phase 6 — Compliance & legal (student PII)

This product stores minors' names, attendance, and academic records. The marketing
app has no privacy policy or terms of service page today.

- [ ] Publish Privacy Policy + Terms of Service on the marketing site
- [ ] Add a data retention/deletion policy (what happens to a suspended school's student data, and after how long)
- [ ] Confirm regional compliance requirements for wherever schools are onboarded (e.g. India's DPDP Act if targeting Indian schools, given `.edu.in` demo domains)
- [ ] Add a documented process for a school admin to export or delete their school's data on request
- [ ] Review whether MFA should be required for SCHOOL_ADMIN/SUPER_ADMIN accounts given the PII exposure

## Phase 7 — Performance & scale

- [ ] Add pagination consistently — it was just added to Fees ([fees-content.tsx](apps/admin-web/src/components/fees/fees-content.tsx)) but audit Students, Teachers, Attendance, and Dashboard/RecentActivity lists for the same unbounded `.map()` over a full table fetch
- [ ] Add DB indexes for the query patterns actually used (schoolId + status filters, schoolId + date-range attendance queries) — review [schema.prisma](packages/db/prisma/schema.prisma) `@@index` coverage against real query shapes
- [ ] Add caching for read-heavy, rarely-changing data (plan limits, class lists) — no Redis/cache layer exists yet
- [ ] Load-test the login and attendance-marking paths (attendance is explicitly designed for "<20 seconds" bulk entry per the README — verify that holds under concurrent teachers on one class)
- [ ] Set Vercel function region close to the Neon/Supabase DB region to cut query latency

## Phase 8 — Feature completeness

Carried over from the README's own "Coming in V2" list — sequence these after
Phases 1–4 are done, not before:

- [ ] Exam & gradebook module
- [ ] Parent portal
- [ ] SMS/Email notifications (mailer exists for password reset only; extend to notices/fees)
- [ ] Timetable generator
- [ ] Library management
- [ ] Custom report builder

---

## Definition of "production ready"

Ship-blocking = Phases 1–3. A customer's data must not leak across tenants, must not
be lost to an unreviewed migration, and a broken deploy must be caught by CI before
it caught by a customer. Phases 4–6 should land within the first post-launch weeks,
not months, given the PII involved. Phase 5's scope depends on a product decision
(see the note in that section) — resolve it before estimating a launch date. Phase 7
and 8 are ongoing, not gates.

Keep [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) as the human sign-off sheet
until Phase 3's E2E suite covers it end to end — then the checklist becomes a
fallback, not the primary safety net.
