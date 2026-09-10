"use client";

import { useState } from "react";
import {
  IndianRupee,
  CheckCircle2,
  Smartphone,
  Bell,
  Bus,
  Shield,
  BarChart3,
  ArrowRight,
  Sparkles,
  Send,
  Users,
  Check,
  X,
  FileText,
  UserCheck,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";

export function FeatureSections() {
  // Interactive state for Attendance simulator
  const [attendance, setAttendance] = useState([
    { id: 1, name: "Aarav Sharma", roll: "101", present: true },
    { id: 2, name: "Diya Patel", roll: "102", present: true },
    { id: 3, name: "Kabir Verma", roll: "103", present: false },
    { id: 4, name: "Sanya Gupta", roll: "104", present: true },
  ]);

  const toggleStudent = (id: number) => {
    setAttendance((prev) =>
      prev.map((s) => (s.id === id ? { ...s, present: !s.present } : s)),
    );
  };

  // Interactive state for Role Switcher
  const [activeRole, setActiveRole] = useState<
    "principal" | "teacher" | "accountant" | "staff"
  >("principal");

  return (
    <section
      id="features"
      className="py-24 bg-slate-50/50 border-b border-slate-200/70"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-28">
        {/* Section Intro */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-violet-100/80 text-violet-800 text-xs font-bold uppercase tracking-wider mb-4 border border-violet-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Core Features Built for Schools</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            Designed Around How Schools Actually Work
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Every module in Kora is designed to be effortless to learn, quick to
            use, and instantly rewarding for your entire staff.
          </p>
        </div>

        {/* FEATURE 1: FEES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-4">
              <IndianRupee className="w-3.5 h-3.5" />
              <span>Fee Management</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Collect Fees Without the Confusion
            </h3>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Automatically keep track of paid, pending and advance fees. Your
              office always knows exactly where things stand without
              cross-checking registers.
            </p>

            <ul className="mt-8 space-y-3.5 text-sm text-slate-700 font-medium">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    One-Click WhatsApp Receipts:
                  </strong>{" "}
                  Parents instantly receive an official fee receipt on their
                  phone.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Gentle Automated Reminders:
                  </strong>{" "}
                  Send respectful due date reminders without awkward phone
                  calls.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Zero Calculation Mistakes:
                  </strong>{" "}
                  Discounts, installments, and siblings concessions are
                  calculated accurately.
                </span>
              </li>
            </ul>
          </div>

          {/* Visual: Fee Overview Card */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between pb-5 border-b border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">
                  Term 2 Fee Collections
                </p>
                <h4 className="text-xl font-extrabold text-slate-900">
                  Total: ₹48,50,000
                </h4>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                92% Collected
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 my-6">
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                <p className="text-[11px] font-bold text-emerald-800">
                  Collected
                </p>
                <p className="text-lg font-extrabold text-slate-900 mt-1">
                  ₹44.6L
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100">
                <p className="text-[11px] font-bold text-rose-800">Pending</p>
                <p className="text-lg font-extrabold text-slate-900 mt-1">
                  ₹3.9L
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-violet-50/70 border border-violet-100">
                <p className="text-[11px] font-bold text-violet-800">Advance</p>
                <p className="text-lg font-extrabold text-slate-900 mt-1">
                  ₹1.2L
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  Recent Student Payment:
                </span>
                <span className="text-slate-500">Today, 11:20 AM</span>
              </div>
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <p className="font-bold text-slate-900">
                    Ishaan Trivedi (Grade 7-A)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Tuition + Transport Fee • Receipt #3094
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-emerald-600 block">
                    ₹22,000
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Paid via UPI
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE 2: ATTENDANCE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Interactive Attendance Simulator */}
          <div className="order-2 lg:order-1 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Grade 5-B Morning Roll Call
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Tap status to mark attendance
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                Live Simulator
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {attendance.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-400 w-8">
                      #{student.roll}
                    </span>
                    <span className="font-bold text-slate-900">
                      {student.name}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleStudent(student.id)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                      student.present
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                    }`}
                  >
                    {student.present ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Present</span>
                      </>
                    ) : (
                      <>
                        <X className="w-3.5 h-3.5" />
                        <span>Absent</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 p-3.5 rounded-xl bg-violet-50/80 border border-violet-100 flex items-center justify-between text-xs text-violet-900">
              <span className="font-medium">
                {attendance.filter((s) => s.present).length} Present •{" "}
                {attendance.filter((s) => !s.present).length} Absent
              </span>
              <span className="font-bold text-violet-700">
                Auto SMS queued for absentees
              </span>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100/80 text-violet-800 text-xs font-bold uppercase tracking-wider mb-4">
              <Users className="w-3.5 h-3.5" />
              <span>Mobile Attendance</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Attendance in Seconds, Right From Your Phone
            </h3>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Teachers can mark attendance quickly from any smartphone, while
              the school leadership gets a clear, instantaneous view of
              attendance every morning.
            </p>

            <ul className="mt-8 space-y-3.5 text-sm text-slate-700 font-medium">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Fast Classroom Roll Call:
                  </strong>{" "}
                  Mark an entire section of 40 students in less than 45 seconds.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Instant Absentee Alerts:
                  </strong>{" "}
                  Parents are notified immediately if their child doesn&apos;t
                  arrive at school.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Monthly Registers Generated Automatically:
                  </strong>{" "}
                  Official attendance records ready for government inspection
                  with 1 click.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* FEATURE 3: COMMUNICATION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100/80 text-rose-800 text-xs font-bold uppercase tracking-wider mb-4">
              <Bell className="w-3.5 h-3.5" />
              <span>School Communication</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Keep Parents in the Loop
            </h3>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Send important notices, updates and reminders without relying on
              endless phone calls or paper flyers that get lost at the bottom of
              backpacks.
            </p>

            <ul className="mt-8 space-y-3.5 text-sm text-slate-700 font-medium">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Class or School-wide Broadcasts:
                  </strong>{" "}
                  Send an update to a single grade or the whole school in 2
                  clicks.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Emergency & Weather Alerts:
                  </strong>{" "}
                  Rain holidays or schedule changes delivered in seconds.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    No Busy Phone Lines:
                  </strong>{" "}
                  Parents stay informed, so your office staff can focus on daily
                  work.
                </span>
              </li>
            </ul>
          </div>

          {/* Visual: Notice Broadcast Card */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Broadcast Notice Dispatched
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Delivered to 1,240 Parents
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                100% Delivered
              </span>
            </div>

            <div className="mt-5 p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-bold text-[10px] uppercase">
                School Notice
              </span>
              <h5 className="font-extrabold text-slate-900 text-sm">
                Term 2 Parent-Teacher Conference Schedule
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dear Parents, Parent-Teacher meetings will be conducted this
                Saturday, Oct 12th from 9:00 AM to 1:00 PM. Please check your
                slot timing in the school calendar.
              </p>
              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-200/60">
                <span>Sent by: Principal Sharma</span>
                <span>Delivery: In-App & SMS</span>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE 4: TRANSPORT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Route Card Visual */}
          <div className="order-2 lg:order-1 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Bus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Bus Route #4 (North Campus)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Driver: Rajesh Kumar • +91 98765 43210
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                On Time
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {[
                {
                  stop: "Civil Lines Junction",
                  students: 14,
                  time: "7:15 AM",
                  status: "Completed",
                },
                {
                  stop: "Model Town Market",
                  students: 18,
                  time: "7:35 AM",
                  status: "Completed",
                },
                {
                  stop: "Green Park Avenue",
                  students: 12,
                  time: "7:55 AM",
                  status: "Next Stop",
                },
                {
                  stop: "School Main Gate",
                  students: 44,
                  time: "8:15 AM",
                  status: "Scheduled",
                },
              ].map((stop, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[10px]">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{stop.stop}</p>
                      <p className="text-[11px] text-slate-500">
                        {stop.students} student passengers
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{stop.time}</p>
                    <span
                      className={`text-[10px] font-bold ${
                        stop.status === "Completed"
                          ? "text-emerald-600"
                          : stop.status === "Next Stop"
                            ? "text-amber-600"
                            : "text-slate-400"
                      }`}
                    >
                      {stop.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/80 text-amber-800 text-xs font-bold uppercase tracking-wider mb-4">
              <Bus className="w-3.5 h-3.5" />
              <span>School Transport</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Make School Transport Easier
            </h3>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Keep routes, students, vehicles and transport charges organized in
              one place without juggling physical sheets and chaotic driver
              phone calls.
            </p>

            <ul className="mt-8 space-y-3.5 text-sm text-slate-700 font-medium">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Route & Stop Roster:
                  </strong>{" "}
                  Instantly know which students board at which bus stop.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Integrated Transport Fees:
                  </strong>{" "}
                  Automatically bill student bus fees according to their
                  distance or stop.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Emergency Contacts at Hand:
                  </strong>{" "}
                  Access driver phone numbers and parent emergency contacts with
                  1 tap.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* FEATURE 5: TEAM ROLES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100/80 text-purple-800 text-xs font-bold uppercase tracking-wider mb-4">
              <Shield className="w-3.5 h-3.5" />
              <span>Role-Based Access</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Give Your Team Everything They Need
            </h3>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Teachers, accountants and administrators can each focus on their
              work while school leadership stays in total control.
            </p>

            <ul className="mt-8 space-y-3.5 text-sm text-slate-700 font-medium">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Everyone Gets the Right Tools:
                  </strong>{" "}
                  Accountants manage fees; teachers mark attendance; principals
                  see the full picture.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Protect Confidential Information:
                  </strong>{" "}
                  Financial numbers stay private from staff who don&apos;t need
                  to see them.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    No Complex Permissions:
                  </strong>{" "}
                  Simple, pre-configured roles that just make sense for schools.
                </span>
              </li>
            </ul>
          </div>

          {/* Visual: Role Card Switcher */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">
                Select Role View:
              </h4>
              <span className="text-xs text-slate-400">
                Click to preview view
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4">
              {(["principal", "teacher", "accountant", "staff"] as const).map(
                (role) => (
                  <button
                    key={role}
                    onClick={() => setActiveRole(role)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition-all border ${
                      activeRole === role
                        ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {role}
                  </button>
                ),
              )}
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
              {activeRole === "principal" && (
                <div>
                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold uppercase">
                    Executive Dashboard
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm mt-2">
                    Principal & Director View
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Complete oversight: total school strength, fee health,
                    teacher attendance, bus routes, and daily operational
                    alerts.
                  </p>
                </div>
              )}
              {activeRole === "teacher" && (
                <div>
                  <span className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-800 text-[10px] font-bold uppercase">
                    Teacher Portal
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm mt-2">
                    Teacher & Class In-Charge View
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Focused on teaching: fast mobile attendance, student
                    profiles, homework updates, and timetable schedule.
                  </p>
                </div>
              )}
              {activeRole === "accountant" && (
                <div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                    Accounts Portal
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm mt-2">
                    Accountant & Fee Desk View
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Rapid fee collection, receipt printing, pending balance
                    lists, concessions, and daily cash reconciliation.
                  </p>
                </div>
              )}
              {activeRole === "staff" && (
                <div>
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">
                    Front Office Portal
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm mt-2">
                    Reception & Administrative Staff
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    New admissions inquiries, parent contact lookup, transport
                    stop verification, and school circular distribution.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FEATURE 6: REPORTS & INSIGHTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Visual: Executive Reports Card */}
          <div className="order-2 lg:order-1 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">
                  Annual Summary
                </p>
                <h4 className="text-lg font-extrabold text-slate-900">
                  Academic Health & Metrics
                </h4>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                Export to Excel
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 my-5">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-500">
                  Student Retention
                </span>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  98.2%
                </p>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                  +2.4% vs last year
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-500">
                  On-Time Fee Rate
                </span>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  94.1%
                </p>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                  Highest on record
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-violet-50/60 border border-violet-100">
              <p className="font-bold text-slate-900 text-xs">
                Principal&apos;s Board Summary Ready
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                One-click presentation report generated with admissions, fee
                collections, and staff retention data.
              </p>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 text-blue-800 text-xs font-bold uppercase tracking-wider mb-4">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Simple Reports</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Know What&apos;s Happening in Your School
            </h3>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Simple reports and summaries help you make confident decisions
              without digging through paperwork or waiting for weekly
              spreadsheets.
            </p>

            <ul className="mt-8 space-y-3.5 text-sm text-slate-700 font-medium">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Clear Financial Summaries:
                  </strong>{" "}
                  See exact revenue, expenses, and pending balances in one
                  glance.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Audit-Ready Records:
                  </strong>{" "}
                  Download clean Excel and PDF files ready for your school board
                  or auditors.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>
                  <strong className="text-slate-900 font-bold">
                    Admissions & Growth Tracking:
                  </strong>{" "}
                  Understand year-on-year enrollment trends without guesswork.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
