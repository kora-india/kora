"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  IndianRupee,
  MoreVertical,
  Pencil,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@schoolos/utils";
import { useQueryTab } from "@/hooks/use-query-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteTeacher } from "@/lib/actions/teachers";
import {
  monthKey,
  recentMonths,
  type PayoutRecord,
  type SalarySlipRecord,
} from "@/lib/payroll";
import { TeacherDialog } from "../teacher-dialog";
import { GenerateSalarySlipDialog } from "../payroll/generate-salary-slip-dialog";
import { SalarySlipDialog } from "../payroll/salary-slip-dialog";
import { ProcessPayoutDialog } from "../payroll/process-payout-dialog";
import { PayoutDetailsDialog } from "../payroll/payout-details-dialog";
import { PayrollTab } from "../payroll/payroll-tab";
import { OverviewTab } from "./overview-tab";
import { ClassesTab } from "./classes-tab";
import { initials, type ProfileSchool, type ProfileTeacher } from "./types";

const TABS = ["overview", "classes", "payroll"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  classes: "Classes",
  payroll: "Payroll",
};

interface Props {
  teacher: ProfileTeacher;
  classes: {
    id: string;
    name: string;
    sections: { id: string; name: string }[];
  }[];
  slips: SalarySlipRecord[];
  payrollReady: boolean;
  school: ProfileSchool | null;
}

export function TeacherProfile({
  teacher,
  classes,
  slips: initialSlips,
  payrollReady,
  school,
}: Readonly<Props>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useQueryTab<Tab>({
    validTabs: TABS,
    defaultTab: "overview",
  });

  const [slips, setSlips] = useState(initialSlips);
  useEffect(() => setSlips(initialSlips), [initialSlips]);

  const current = recentMonths(1)[0];
  const [selectedMonth, setSelectedMonth] = useState(
    monthKey(current.year, current.month),
  );

  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [generate, setGenerate] = useState<{ open: boolean; month?: string }>({
    open: false,
  });
  const [viewSlip, setViewSlip] = useState<{
    slip: SalarySlipRecord;
    autoPrint: boolean;
  } | null>(null);
  const [payoutSlip, setPayoutSlip] = useState<SalarySlipRecord | null>(null);
  const [payoutDetails, setPayoutDetails] = useState<{
    slip: SalarySlipRecord;
    payout: PayoutRecord;
  } | null>(null);

  const canGenerate = teacher.isActive && payrollReady;

  // Deep links from the teacher card menu: ?tab=payroll&action=generate
  useEffect(() => {
    if (searchParams.get("action") !== "generate") return;
    if (canGenerate) setGenerate({ open: true });
    const params = new URLSearchParams(window.location.search);
    params.delete("action");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upsertSlip = (slip: SalarySlipRecord) => {
    setSlips((prev) =>
      [slip, ...prev.filter((s) => s.id !== slip.id)].sort(
        (a, b) => b.year - a.year || b.month - a.month,
      ),
    );
    router.refresh();
  };

  const openGenerate = (month?: string) => {
    if (!payrollReady) {
      setTab("payroll");
      return;
    }
    setGenerate({ open: true, month });
  };

  const handleDeactivate = async () => {
    const res = await deleteTeacher(teacher.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`${teacher.name} has been deactivated`);
    router.push("/teachers");
    router.refresh();
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <Link
        href="/teachers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Teachers & Staff
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-lg font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
            {initials(teacher.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                {teacher.name}
              </h1>
              {!teacher.isActive && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {teacher.subject}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 h-9 px-3.5 border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            <Pencil className="w-4 h-4" /> Edit Teacher
          </button>
          <button
            type="button"
            disabled={!teacher.isActive}
            onClick={() => openGenerate()}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Generate Salary Slip</span>
            <span className="sm:hidden">Salary Slip</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions"
                className="h-9 w-9 flex items-center justify-center border rounded-lg hover:bg-muted transition-colors data-[state=open]:bg-muted flex-shrink-0"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setTab("payroll")}>
                <IndianRupee className="w-3.5 h-3.5" />
                <span>View Payroll</span>
              </DropdownMenuItem>
              {teacher.isActive && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeactivateOpen(true)}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Deactivate Teacher</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Teacher profile sections"
        className="flex items-center gap-1 border-b overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-all",
              tab === t
                ? "border-violet-600 text-violet-600 dark:text-violet-400"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {TAB_LABELS[t]}
            {t === "payroll" &&
              slips.some(
                (s) => s.status === "GENERATED" || s.status === "APPROVED",
              ) && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-amber-500"
                  aria-label="Unpaid salary slips"
                />
              )}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "overview" && (
          <OverviewTab
            teacher={teacher}
            slips={slips}
            onOpenClasses={() => setTab("classes")}
            onOpenPayroll={() => setTab("payroll")}
          />
        )}
        {tab === "classes" && <ClassesTab teacher={teacher} />}
        {tab === "payroll" && (
          <PayrollTab
            slips={slips}
            monthlySalary={teacher.salary}
            payrollReady={payrollReady}
            canGenerate={canGenerate}
            selectedMonth={selectedMonth}
            onSelectedMonthChange={setSelectedMonth}
            onGenerate={(m) => openGenerate(m)}
            onView={(slip) => setViewSlip({ slip, autoPrint: false })}
            onDownload={(slip) => setViewSlip({ slip, autoPrint: true })}
            onPayout={(slip) => setPayoutSlip(slip)}
            onPayoutDetails={(slip, payout) =>
              setPayoutDetails({ slip, payout })
            }
          />
        )}
      </div>

      <TeacherDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        teacher={teacher}
        classes={classes}
      />

      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="Deactivate Teacher"
        description={`Deactivate ${teacher.name}? Their login will be disabled and they'll be removed from the active teacher list. Salary and class records are preserved.`}
        confirmLabel="Deactivate"
        onConfirm={handleDeactivate}
      />

      <GenerateSalarySlipDialog
        open={generate.open}
        onOpenChange={(open) => setGenerate({ open })}
        teacher={teacher}
        slips={slips}
        initialMonth={generate.month}
        onGenerated={(slip) => {
          setGenerate({ open: false });
          upsertSlip(slip);
          setSelectedMonth(monthKey(slip.year, slip.month));
          setTab("payroll");
          setViewSlip({ slip, autoPrint: false });
        }}
      />

      <SalarySlipDialog
        slip={viewSlip?.slip ?? null}
        autoPrint={viewSlip?.autoPrint}
        onClose={() => setViewSlip(null)}
        teacher={teacher}
        school={school}
        onProcessPayout={(slip) => {
          setViewSlip(null);
          setPayoutSlip(slip);
        }}
        onSent={() => router.refresh()}
      />

      <ProcessPayoutDialog
        slip={payoutSlip}
        teacherName={teacher.name}
        onClose={() => setPayoutSlip(null)}
        onPaid={upsertSlip}
      />

      <PayoutDetailsDialog
        target={payoutDetails}
        onClose={() => setPayoutDetails(null)}
      />

      {!teacher.isActive && (
        <p className="sr-only" role="status">
          This teacher is inactive. Salary slips can't be generated.
        </p>
      )}
    </div>
  );
}
