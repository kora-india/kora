# SchoolOS — Pre-Deployment Checklist

Run through this list before every production deploy and before every customer demo.

---

## ✅ Environment & Build

- [ ] `.env` has all required variables (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`)
- [ ] `NEXTAUTH_SECRET` is at least 32 characters and unique to production
- [ ] `NEXTAUTH_URL` matches the exact deployment URL (no trailing slash)
- [ ] `NODE_ENV=production` is set in the deploy environment
- [ ] `pnpm build` passes with zero errors
- [ ] `pnpm type-check` passes with zero errors
- [ ] No `.env` file is committed to git (check `.gitignore`)

---

## ✅ Database

- [ ] `prisma migrate deploy` ran successfully against the production DB
- [ ] Health check returns `"status": "ok"` → `GET /api/health`
- [ ] Database latency in health check is under 500ms
- [ ] Seed ran successfully if this is a demo environment

---

## ✅ Authentication

- [ ] Login works for School Admin (`admin@dps.edu.in` / `admin123`)
- [ ] Login works for Teacher (`priya@dps.edu.in` / `teacher123`)
- [ ] Login works for Super Admin (`super@schoolos.com` / `admin123`)
- [ ] Wrong password shows correct error toast, does not crash
- [ ] Quick-login demo buttons on login page work
- [ ] After login, user lands on `/dashboard`
- [ ] Logged-out user hitting `/dashboard` redirects to `/login`
- [ ] Logged-in user hitting `/login` redirects to `/dashboard`

---

## ✅ Role-Based Access Control

- [ ] SCHOOL_ADMIN can access: Students, Teachers, Classes, Fees, Attendance, Notices
- [ ] TEACHER can access: Dashboard, Attendance, Students (read), Assignments, Notices
- [ ] ACCOUNTANT can access: Dashboard, Fees
- [ ] TEACHER cannot reach `/teachers` or `/classes` (redirects to `/dashboard`)
- [ ] SUPER_ADMIN can access: Schools page, all tenants visible
- [ ] SUPER_ADMIN cannot access a school's student list (no `schoolId`)

---

## ✅ School Isolation (Multi-Tenancy)

- [ ] Admin of School A cannot see students of School B
- [ ] Creating a student attaches to the correct `schoolId`
- [ ] Updating a student verifies `schoolId` matches session
- [ ] Deleting a student verifies `schoolId` matches session
- [ ] Same checks pass for teachers, fees, attendance, notices

---

## ✅ School Creation (Super Admin)

- [ ] "Add School" modal opens and validates all fields
- [ ] Subdomain with spaces or uppercase is rejected
- [ ] Duplicate subdomain shows a clear error
- [ ] Duplicate admin email shows a clear error
- [ ] Successful creation shows temporary password dialog
- [ ] Temporary password can be copied to clipboard
- [ ] New school appears in the table immediately after creation
- [ ] "Seed default classes" checkbox creates Grade 6–12 with Sections A & B

---

## ✅ School Suspension

- [ ] Super Admin can suspend a school from the actions menu
- [ ] Confirmation modal appears before suspending
- [ ] After suspension, school shows "Suspended" status in table
- [ ] Suspended school's users see `/suspended` page on next navigation
- [ ] `/suspended` page does not redirect-loop back to `/login`
- [ ] Super Admin can reactivate the school
- [ ] After reactivation, school users can log in normally

---

## ✅ Plan Limit Enforcement

- [ ] FREE plan: adding the 51st student shows upgrade error toast
- [ ] FREE plan: adding the 6th teacher shows upgrade error toast
- [ ] FREE plan: adding the 6th class shows upgrade error toast
- [ ] Error message names the limit and the current plan
- [ ] PRO plan: no limits hit in demo data
- [ ] No hard crash — always a toast, never a 500 error

---

## ✅ Core Features

### Students
- [ ] Student list loads and displays correctly
- [ ] Search by name, roll number, admission number works
- [ ] Class filter works
- [ ] Add student form validates and saves
- [ ] Edit student updates correctly
- [ ] Remove student soft-deletes (marks `isActive: false`)
- [ ] Empty state shows when no students match filters

### Teachers
- [ ] Teacher grid loads correctly
- [ ] Add teacher creates a User + Teacher record in a transaction
- [ ] Default password `Welcome@123` is set for new teachers
- [ ] Edit teacher updates name/email/subject
- [ ] Remove teacher deactivates both Teacher and User records
- [ ] Empty state shows correctly

### Classes
- [ ] Class cards load and show student counts
- [ ] Add class validates name + grade
- [ ] Add section validates and links to correct class
- [ ] Delete class/section shows confirmation
- [ ] Empty state shows and prompts to add class

### Attendance
- [ ] Attendance page loads class list
- [ ] Teacher sees only their assigned class
- [ ] Marking attendance saves correctly for each student
- [ ] Past attendance is read-only
- [ ] Attendance saved shows success toast

### Fees
- [ ] Fee summary cards show correct totals
- [ ] Status filter works (All / PENDING / OVERDUE / PAID / WAIVED)
- [ ] Create fee validates all fields
- [ ] Mark Paid records payment and updates status
- [ ] Mark Overdue changes status
- [ ] Delete fee shows confirmation
- [ ] Empty state shows correctly

### Notices
- [ ] Notice list loads
- [ ] Create notice saves and appears immediately
- [ ] Priority badge (HIGH/MEDIUM/LOW) displays correctly

---

## ✅ Loading & Error States

- [ ] Navigating between pages shows skeleton loaders (not blank screen)
- [ ] Page fade-in transition is smooth
- [ ] Breaking a DB query shows the error.tsx retry page
- [ ] "Try again" button on error page reloads correctly
- [ ] 404 page shows for unknown routes
- [ ] `/suspended` page shows for suspended school users

---

## ✅ Teacher PWA

- [ ] PWA loads on mobile Chrome
- [ ] Login works on mobile
- [ ] Attendance marking works with touch targets
- [ ] Page transitions are smooth on mobile
- [ ] No horizontal scroll on small screens (375px width)

---

## ✅ Security

- [ ] `/api/health` returns `200` — no sensitive data exposed
- [ ] Server actions return `{ error: "Unauthorized" }` when unauthenticated
- [ ] Direct URL access to `/students` while logged out redirects to `/login`
- [ ] `X-Frame-Options: DENY` header present on responses
- [ ] `X-Content-Type-Options: nosniff` header present
- [ ] No stack traces exposed in production error responses

---

## ✅ Demo Readiness

- [ ] At least 60 students across multiple grades seeded
- [ ] At least 8 teachers seeded
- [ ] 30 days of attendance history present
- [ ] Fee records show a mix of PAID / PENDING / OVERDUE
- [ ] At least 5 notices seeded with realistic content
- [ ] At least 3 schools visible in Super Admin schools table
- [ ] Quick-login buttons on login page work for all 3 demo roles
- [ ] Dashboard stats look realistic (not all zeros)

---

## Sign-off

| Check | Owner | Date |
|-------|-------|------|
| Build passes | | |
| Health check passing | | |
| Auth flows tested | | |
| RBAC verified | | |
| School isolation verified | | |
| Demo data looks realistic | | |
| Mobile PWA tested | | |
