/**
 * Everything the landing page claims, in one place. Each line describes what
 * the product does today (see the README's "What's included"); prices and the
 * trial come from the plan catalogue. Parent portal, SMS/email and library
 * are planned, not shipped, so they are not offered here.
 */
import {
  BarChart3,
  Banknote,
  Bus,
  CalendarCheck,
  ClipboardList,
  Clock,
  MonitorSmartphone,
  Sparkles,
  Users,
  Wallet,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import {
  PLANS,
  TRIAL_DURATION_DAYS,
  TRIAL_PLAN,
  formatLimit,
  formatPlanPrice,
} from "@/lib/plans";

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Modules", href: "#modules" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export const TRIAL = {
  days: TRIAL_DURATION_DAYS,
  planName: PLANS[TRIAL_PLAN].name,
  students: formatLimit(PLANS[TRIAL_PLAN].limits.maxStudents),
};

export const MODULES: { label: string; icon: LucideIcon }[] = [
  { label: "Students & staff", icon: Users },
  { label: "Attendance", icon: CalendarCheck },
  { label: "Fees & receipts", icon: Wallet },
  { label: "Exams & report cards", icon: ClipboardList },
  { label: "Timetable", icon: Clock },
  { label: "Transport", icon: Bus },
  { label: "Payroll", icon: Banknote },
  { label: "Reports & analytics", icon: BarChart3 },
];

export const FEATURES: {
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Student & staff records",
    description:
      "Profiles, admission numbers and classes, imported from your spreadsheets.",
    icon: Users,
  },
  {
    title: "Attendance in seconds",
    description: "Teachers mark it on their phones, even without internet.",
    icon: CalendarCheck,
  },
  {
    title: "Fee collection",
    description: "Monthly fees, receipts, late fees and advance payments.",
    icon: Wallet,
  },
  {
    title: "Exams & report cards",
    description:
      "Marks entry, CBSE or letter grading, and printable report cards.",
    icon: ClipboardList,
  },
  {
    title: "Timetable",
    description: "Clash checks as you plan, or let AI draft the week for you.",
    icon: Clock,
  },
  {
    title: "Transport",
    description: "Routes, stops and bus fees, kept with each student's fees.",
    icon: Bus,
  },
];

export const FACTS: {
  value: string;
  label: string;
  icon: LucideIcon;
}[] = [
  {
    value: `${TRIAL_DURATION_DAYS} days`,
    label: `Free trial with every ${PLANS[TRIAL_PLAN].name} feature`,
    icon: Sparkles,
  },
  {
    value: `${formatPlanPrice(PLANS.BASIC)}/mo`,
    label: "Starting price, paid monthly with no auto-renewal",
    icon: Wallet,
  },
  {
    value: "3 apps",
    label: "Web dashboard, desktop app and a teacher phone app",
    icon: MonitorSmartphone,
  },
  {
    value: "Offline",
    label: "Attendance marked without internet syncs later",
    icon: WifiOff,
  },
];

export const STEPS = [
  {
    title: "Create your account",
    description:
      "Sign up with your email. We send a code to confirm it's yours.",
  },
  {
    title: "Set up your school",
    description:
      "Four short steps. We create your session, your classes and common fee heads.",
  },
  {
    title: "Bring in your people",
    description:
      "Import students and staff from a spreadsheet, and give teachers their logins.",
  },
];

export const FAQS = [
  {
    q: "Is Kora difficult to set up?",
    a: "No. After you sign up, a four-step setup asks for your school's details, classes and plan, then creates your academic session, classes and common fee heads. Add students and staff yourself or import them from a spreadsheet.",
  },
  {
    q: "Can teachers use Kora from their phones?",
    a: "Yes. Teachers get a phone app that installs from the browser on Android or iPhone. They can mark attendance and see their timetable and students. Attendance marked without internet is sent when the phone reconnects.",
  },
  {
    q: "Can I manage fees and print receipts?",
    a: "Yes. Set up fee structures, generate each month's fees, collect payments with receipts, and keep track of late fees and advance payments.",
  },
  {
    q: "Can we share notices and homework?",
    a: "Yes. Publish notices and homework for your school from the dashboard. A parent portal and SMS and email alerts are planned but not available yet.",
  },
  {
    q: "Can Kora manage school transport?",
    a: "Yes. Set up routes and stops, assign students to them, and include bus fees in their fee charges.",
  },
  {
    q: "Can several staff members use it at the same time?",
    a: "Yes. Admins, teachers and accountants each have their own login and see only the parts of Kora their role needs.",
  },
  {
    q: "Can I move our existing school data into Kora?",
    a: "Yes. Import student lists from a spreadsheet. On the Enterprise plan we also help you move data from your old software.",
  },
  {
    q: "How does the free trial work?",
    a: `You get ${TRIAL_DURATION_DAYS} days of every ${PLANS[TRIAL_PLAN].name} feature, for up to ${formatLimit(PLANS[TRIAL_PLAN].limits.maxStudents)} students, with no payment to start. When the trial ends, choose a plan to keep going. Your data stays exactly as you left it.`,
  },
];
