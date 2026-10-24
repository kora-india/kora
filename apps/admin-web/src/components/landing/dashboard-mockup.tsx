import Image from "next/image";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bus,
  Calendar,
  ChevronDown,
  Clock,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@schoolos/utils";

// Kora's sidebar, in its own order. Everything else here is sample data.
const NAV = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Students", icon: Users },
  { label: "Teachers / Staff", icon: GraduationCap },
  { label: "Classes", icon: BookOpen },
  { label: "Timetable", icon: Clock },
  { label: "Attendance", icon: Calendar },
  { label: "Exams & Results", icon: Award },
  { label: "Fees", icon: DollarSign },
  { label: "Transport", icon: Bus },
  { label: "Analytics", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

const STATS = [
  { label: "Students", value: "1,248" },
  { label: "Teachers", value: "86" },
  { label: "Classes", value: "38" },
  { label: "Fees collected", value: "₹24.5L" },
];

const ATTENDANCE = [
  { month: "Apr", pct: 91 },
  { month: "May", pct: 88 },
  { month: "Jun", pct: 93 },
  { month: "Jul", pct: 92 },
  { month: "Aug", pct: 96 },
  { month: "Sep", pct: 94 },
];

const NOTICES = [
  {
    day: "12",
    month: "Oct",
    title: "Parent–teacher meeting",
    detail: "10:00 – 12:00",
  },
  {
    day: "15",
    month: "Oct",
    title: "Science exhibition",
    detail: "Grades 6 – 10",
  },
  {
    day: "21",
    month: "Oct",
    title: "Term 1 examinations",
    detail: "All classes",
  },
];

export const MOCKUP_WIDTH = 780;
export const MOCKUP_HEIGHT = 432;

function AttendanceChart() {
  // 80%–100% fills the 120-unit height; months spread across 300 units.
  const x = (i: number) => 18 + (i * 274) / (ATTENDANCE.length - 1);
  const y = (pct: number) => 112 - ((pct - 80) / 20) * 104;
  const line = ATTENDANCE.map((p, i) => `${x(i)},${y(p.pct)}`).join(" ");
  const area = `${x(0)},112 ${line} ${x(ATTENDANCE.length - 1)},112`;
  return (
    <svg viewBox="0 0 300 132" className="h-[150px] w-full" aria-hidden>
      <defs>
        <linearGradient id="mockup-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[100, 95, 90, 85, 80].map((pct) => (
        <g key={pct}>
          <line x1="18" x2="296" y1={y(pct)} y2={y(pct)} stroke="#eef0f4" />
          <text x="0" y={y(pct) + 3} fontSize="7" fill="#94a3b8">
            {pct}%
          </text>
        </g>
      ))}
      <polygon points={area} fill="url(#mockup-area)" />
      <polyline
        points={line}
        fill="none"
        stroke="#7c3aed"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {ATTENDANCE.map((p, i) => (
        <g key={p.month}>
          <circle
            cx={x(i)}
            cy={y(p.pct)}
            r="2.6"
            fill="#fff"
            stroke="#7c3aed"
            strokeWidth="1.6"
          />
          <text
            x={x(i)}
            y="128"
            fontSize="7"
            fill="#94a3b8"
            textAnchor="middle"
          >
            {p.month}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** A still of Kora's dashboard, drawn at MOCKUP_WIDTH × MOCKUP_HEIGHT. */
export function DashboardMockup() {
  return (
    <div
      className="flex overflow-hidden rounded-2xl border border-violet-100 bg-white text-slate-900"
      style={{ width: MOCKUP_WIDTH, height: MOCKUP_HEIGHT }}
    >
      <div className="w-[164px] shrink-0 border-r border-slate-100 px-3 py-4">
        <div className="mb-5 flex items-center gap-2 px-2">
          <Image
            src="/kora-icon.png"
            alt=""
            width={22}
            height={22}
            className="h-[22px] w-[22px]"
          />
          <span className="text-[14px] font-bold tracking-tight">Kora</span>
        </div>
        <ul className="space-y-0.5">
          {NAV.map((item, i) => (
            <li
              key={item.label}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[11px]",
                i === 0
                  ? "bg-violet-50 font-semibold text-violet-700"
                  : "text-slate-500",
              )}
            >
              <item.icon
                className={cn("h-3.5 w-3.5", i === 0 && "text-violet-600")}
              />
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-[#fbfaff]">
        <div className="flex h-12 items-center gap-3 border-b border-slate-100 bg-white px-5">
          <div className="flex h-7 w-48 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] text-slate-400">
            <Search className="h-3 w-3" />
            Search students, staff…
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200">
              <Bell className="h-3.5 w-3.5 text-slate-500" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700">
                AR
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-4 p-5">
          <div>
            <p className="text-[17px] font-bold tracking-tight">Dashboard</p>
            <p className="text-[11px] text-slate-500">Welcome back, Asha</p>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={cn(
                  "rounded-xl px-3.5 py-3",
                  i === 0
                    ? "bg-violet-600 text-white shadow-[0_8px_18px_-6px_rgba(124,58,237,0.55)]"
                    : "border border-slate-100 bg-white shadow-[0_2px_6px_rgba(15,23,42,0.04)]",
                )}
              >
                <p className="text-[19px] font-bold tabular-nums leading-tight">
                  {stat.value}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[10px]",
                    i === 0 ? "text-violet-100" : "text-slate-500",
                  )}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="flex-1 rounded-xl border border-slate-100 bg-white p-3.5 shadow-[0_2px_6px_rgba(15,23,42,0.04)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold">Attendance overview</p>
                <span className="flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[9px] text-slate-500">
                  This session <ChevronDown className="h-2.5 w-2.5" />
                </span>
              </div>
              <AttendanceChart />
            </div>
            <div className="w-[206px] shrink-0 rounded-xl border border-slate-100 bg-white p-3.5 shadow-[0_2px_6px_rgba(15,23,42,0.04)]">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold">Latest notices</p>
                <span className="text-[9px] font-medium text-violet-600">
                  View all
                </span>
              </div>
              <ul className="space-y-3">
                {NOTICES.map((n) => (
                  <li key={n.title} className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-violet-50 leading-none text-violet-700">
                      <span className="text-[12px] font-bold">{n.day}</span>
                      <span className="text-[8px]">{n.month}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-semibold">
                        {n.title}
                      </span>
                      <span className="block text-[9px] text-slate-500">
                        {n.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
