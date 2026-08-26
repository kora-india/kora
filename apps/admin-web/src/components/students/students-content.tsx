"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, MoreVertical, Users, Upload, ArrowUpDown, X, CheckCircle2, Clock, AlertCircle, XCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@schoolos/utils";
import { StudentDialog } from "./student-dialog";
import { ImportStudentsDialog } from "./import-students-dialog";
import { StudentFeeCollection } from "./student-fee-collection";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteStudent, getStudentDetails } from "@/lib/actions/students";
import { Modal, Tabs, ConfigProvider, Spin, Select } from "antd";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";


const FEE_BADGE: Record<string, string> = {
  PAID: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  OVERDUE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  PARTIAL: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  WAIVED: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800",
  "NO DUES": "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
};

const ATTENDANCE_BADGE: Record<string, { label: string; badge: string }> = {
  PRESENT: { label: "Present", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
  ABSENT: { label: "Absent", badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" },
  LATE: { label: "Late", badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800" },
  EXCUSED: { label: "Excused", badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  NOT_MARKED: { label: "Not Marked", badge: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800" },
};

interface Props {
  students: any[];
  classes: { id: string; name: string; sections: { id: string; name: string }[] }[];
  canEdit: boolean;
}

const PAGE_SIZE = 20;

export function StudentsContent({ students, classes, canEdit }: Readonly<Props>) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedFeeStatus, setSelectedFeeStatus] = useState("all");
  const [selectedAttendanceStatus, setSelectedAttendanceStatus] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [page, setPage] = useState(1);

  const [dialog, setDialog] = useState<"closed" | "create" | "edit" | "import">("closed");
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedChargeId, setExpandedChargeId] = useState<string | null>(null);
  const [detailsModal, setDetailsModal] = useState<{
    open: boolean;
    loading: boolean;
    student: any;
    activeTab: string;
  }>({ open: false, loading: false, student: null, activeTab: "1" });

  // Get available sections based on selected class (from classes data and students records)
  const availableSections = useMemo(() => {
    const sectionMap = new Map<string, { id: string; name: string }>();

    // 1. From classes data
    if (selectedClass) {
      const cls = classes.find((c) => c.id === selectedClass || c.name === selectedClass);
      cls?.sections?.forEach((s: any) => {
        if (s?.name) sectionMap.set(s.name, { id: s.id || s.name, name: s.name });
      });
    } else {
      classes.forEach((c) => {
        c.sections?.forEach((s: any) => {
          if (s?.name && !sectionMap.has(s.name)) {
            sectionMap.set(s.name, { id: s.id || s.name, name: s.name });
          }
        });
      });
    }

    // 2. Also extract from student records (guarantees sections always show up regardless of caching)
    const targetStudents = selectedClass
      ? students.filter((s) => s.classId === selectedClass || s.class?.name === selectedClass || s.class?.id === selectedClass)
      : students;

    targetStudents.forEach((s) => {
      const secName = s.section?.name;
      const secId = s.sectionId || s.section?.id || secName;
      if (secName && !sectionMap.has(secName)) {
        sectionMap.set(secName, { id: secId, name: secName });
      }
    });

    return Array.from(sectionMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [classes, students, selectedClass]);

  // Filter and Sort Students
  const filteredAndSorted = useMemo(() => {
    let result = students.filter((s) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q) ||
        s.parentName?.toLowerCase().includes(q) ||
        s.parentPhone?.includes(q);

      const matchClass =
        !selectedClass ||
        s.classId === selectedClass ||
        s.class?.id === selectedClass ||
        s.class?.name === selectedClass;
      
      const matchSection =
        !selectedSection ||
        s.sectionId === selectedSection ||
        s.section?.id === selectedSection ||
        s.section?.name === selectedSection;

      // Fee Status matching
      const studentFeeStatus = s.feeCharges?.[0]?.status ?? "NO DUES";
      const matchFeeStatus =
        selectedFeeStatus === "all" ||
        (selectedFeeStatus === "NO_DUES" ? (studentFeeStatus === "NO DUES" || studentFeeStatus === "PAID") : studentFeeStatus === selectedFeeStatus);

      // Attendance Status matching
      const studentAttendanceStatus = s.attendances?.[0]?.status ?? "NOT_MARKED";
      const matchAttendance =
        selectedAttendanceStatus === "all" ||
        studentAttendanceStatus === selectedAttendanceStatus;

      return matchSearch && matchClass && matchSection && matchFeeStatus && matchAttendance;
    });

    // Sorting
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "roll_asc": {
          const aNum = Number.parseInt(a.rollNumber, 10);
          const bNum = Number.parseInt(b.rollNumber, 10);
          if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
          return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
        }
        case "roll_desc": {
          const aNum = Number.parseInt(a.rollNumber, 10);
          const bNum = Number.parseInt(b.rollNumber, 10);
          if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return bNum - aNum;
          return b.rollNumber.localeCompare(a.rollNumber, undefined, { numeric: true });
        }
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "admission_asc":
          return a.admissionNumber.localeCompare(b.admissionNumber, undefined, { numeric: true });
        case "admission_desc":
          return b.admissionNumber.localeCompare(a.admissionNumber, undefined, { numeric: true });
        default:
          return 0;
      }
    });

    return result;
  }, [students, search, selectedClass, selectedSection, selectedFeeStatus, selectedAttendanceStatus, sortBy]);

  const totalPages = Math.ceil(filteredAndSorted.length / PAGE_SIZE);
  const paginated = filteredAndSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasActiveFilters = Boolean(
    search ||
    selectedClass ||
    selectedSection ||
    selectedFeeStatus !== "all" ||
    selectedAttendanceStatus !== "all" ||
    sortBy !== "default"
  );

  const handleResetFilters = () => {
    setSearch("");
    setSelectedClass("");
    setSelectedSection("");
    setSelectedFeeStatus("all");
    setSelectedAttendanceStatus("all");
    setSortBy("default");
    setPage(1);
  };

  const handleEdit = (student: any) => {
    setEditTarget(student);
    setDialog("edit");
    setOpenMenuId(null);
  };

  const handleDelete = async () => {
    const result = await deleteStudent(deleteTarget.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Student removed");
      router.refresh();
    }
  };

  const handleOpenStudentModal = async (studentId: string, initialTab: string = "1") => {
    setDetailsModal({ open: true, loading: true, student: null, activeTab: initialTab });
    setExpandedChargeId(null);
    const result = await getStudentDetails(studentId);
    if (result.success) {
      setDetailsModal({ open: true, loading: false, student: result.student, activeTab: initialTab });
    } else {
      setDetailsModal({ open: false, loading: false, student: null, activeTab: "1" });
      toast.error(result.error || "Failed to load student details");
    }
  };

  const refreshStudentDetails = async (studentId: string) => {
    const result = await getStudentDetails(studentId);
    if (result.success) {
      setDetailsModal((prev) => ({ ...prev, student: result.student }));
    }
    router.refresh();
  };

  const handleRowClick = (studentId: string) => {
    handleOpenStudentModal(studentId, "1");
  };

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#7c3aed', borderRadius: 8 } }}>
      <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {students.length} students enrolled
            {hasActiveFilters && (
              <span className="text-violet-600 font-medium ml-1.5">
                ({filteredAndSorted.length} matching filters)
              </span>
            )}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDialog("import")}
              className="flex items-center gap-2 h-9 px-4 bg-background border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button
              type="button"
              onClick={() => setDialog("create")}
              className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Student
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2.5 flex-wrap items-center bg-card p-3 rounded-xl border">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            aria-label="Search students"
            placeholder="Search name, roll, admission, parent..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Class Filter */}
        <Select
          placeholder="All Classes"
          value={selectedClass || undefined}
          onChange={(val) => { 
            setSelectedClass(val || ""); 
            setSelectedSection(""); 
            setPage(1); 
          }}
          allowClear
          className="min-w-[130px] h-9"
          options={[
            { label: "All Classes", value: "" },
            ...classes.map((c) => ({ label: c.name, value: c.id })),
          ]}
        />

        {/* Section Filter */}
        <Select
          placeholder="All Sections"
          value={selectedSection || undefined}
          onChange={(val) => { setSelectedSection(val || ""); setPage(1); }}
          allowClear
          className="min-w-[130px] h-9"
          options={[
            { label: "All Sections", value: "" },
            ...availableSections.map((s) => ({
              label: `Section ${s.name}`,
              value: s.name,
            })),
          ]}
        />

        {/* Fee Status Filter */}
        <Select
          placeholder="Fee Status"
          value={selectedFeeStatus}
          onChange={(val) => { setSelectedFeeStatus(val); setPage(1); }}
          className="min-w-[150px] h-9"
          options={[
            { label: "Fee: All Statuses", value: "all" },
            { label: "Fee: Pending", value: "PENDING" },
            { label: "Fee: Paid / No Dues", value: "PAID" },
            { label: "Fee: Partial", value: "PARTIAL" },
            { label: "Fee: Overdue", value: "OVERDUE" },
            { label: "Fee: Waived", value: "WAIVED" },
          ]}
        />

        {/* Attendance Filter */}
        <Select
          placeholder="Attendance"
          value={selectedAttendanceStatus}
          onChange={(val) => { setSelectedAttendanceStatus(val); setPage(1); }}
          className="min-w-[160px] h-9"
          options={[
            { label: "Attendance: All", value: "all" },
            { label: "Attendance: Present", value: "PRESENT" },
            { label: "Attendance: Absent", value: "ABSENT" },
            { label: "Attendance: Late", value: "LATE" },
            { label: "Attendance: Excused", value: "EXCUSED" },
            { label: "Attendance: Not Marked", value: "NOT_MARKED" },
          ]}
        />

        {/* Sort Options */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
          <Select
            value={sortBy}
            onChange={(val) => { setSortBy(val); setPage(1); }}
            className="min-w-[180px] h-9 font-medium"
            options={[
              { label: "Sort: Default", value: "default" },
              { label: "Roll Number (1 → 100)", value: "roll_asc" },
              { label: "Roll Number (100 → 1)", value: "roll_desc" },
              { label: "Name (A → Z)", value: "name_asc" },
              { label: "Name (Z → A)", value: "name_desc" },
              { label: "Admission No. (A → Z)", value: "admission_asc" },
              { label: "Admission No. (Z → A)", value: "admission_desc" },
            ]}
          />
        </div>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="flex items-center gap-1 h-9 px-3 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border bg-card overflow-hidden shadow-sm"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="h-10 px-5 text-left text-xs font-medium text-muted-foreground uppercase">Student</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Admission No.</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Class</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Parent</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Attendance</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Fee Status</th>
              {canEdit && <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginated.map((s, i) => {
              const attRecord = s.attendances?.[0]?.status ?? "NOT_MARKED";
              const attConfig = ATTENDANCE_BADGE[attRecord] ?? ATTENDANCE_BADGE.NOT_MARKED;

              return (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: i * 0.02 } }}
                  className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(s.id)}
                >
                  <td className="h-12 px-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-[10px] font-semibold text-violet-700 dark:text-violet-300 flex-shrink-0">
                        {s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">Roll #{s.rollNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="h-12 px-4 text-xs text-muted-foreground">{s.admissionNumber}</td>
                  <td className="h-12 px-4 text-xs">{s.class?.name} · {s.section?.name}</td>
                  <td className="h-12 px-4">
                    <p className="text-xs font-medium">{s.parentName}</p>
                    <p className="text-[10px] text-muted-foreground">{s.parentPhone}</p>
                  </td>
                  <td className="h-12 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${attConfig.badge}`}>
                      {attConfig.label}
                    </span>
                  </td>
                  <td className="h-12 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${FEE_BADGE[s.feeCharges?.[0]?.status] ?? FEE_BADGE.PAID}`}>
                      {s.feeCharges?.[0]?.status ?? "NO DUES"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="h-12 px-4" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Student actions"
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/20 data-[state=open]:bg-muted"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleEdit(s)}>
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenStudentModal(s.id, "2")}
                            className="text-violet-600 dark:text-violet-400 font-medium focus:text-violet-600 focus:bg-violet-50 dark:focus:bg-violet-950/30"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Collect Fee</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(s)}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </motion.tr>
              );
            })}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 7 : 6}>
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Users className="w-6 h-6 text-muted-foreground opacity-50" />
                    </div>
                    <p className="text-sm font-semibold mb-1">
                      {hasActiveFilters ? "No students match your filters" : "No students yet"}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                      {hasActiveFilters
                        ? "Try adjusting or resetting your search and filter criteria."
                        : "Add your first student to get started tracking enrollment."}
                    </p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="h-8 px-4 border rounded-lg text-xs hover:bg-muted transition-colors"
                      >
                        Reset filters
                      </button>
                    ) : canEdit && (
                      <button
                        type="button"
                        onClick={() => setDialog("create")}
                        className="flex items-center gap-2 h-8 px-4 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Student
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredAndSorted.length)} of {filteredAndSorted.length}</span>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-xs transition-colors ${p === page ? "bg-violet-600 text-white" : "hover:bg-muted"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <StudentDialog
        open={dialog === "create" || dialog === "edit"}
        onOpenChange={(open) => { if (!open) { setDialog("closed"); setEditTarget(null); } }}
        student={editTarget}
        classes={classes}
      />

      <ImportStudentsDialog
        open={dialog === "import"}
        onOpenChange={(open) => { if (!open) setDialog("closed"); }}
        classes={classes}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Remove Student"
        description={`Are you sure you want to remove ${deleteTarget?.name}? This will deactivate their account but preserve historical records.`}
        confirmLabel="Remove"
        onConfirm={handleDelete}
      />

      <Modal
        open={detailsModal.open}
        onCancel={() => setDetailsModal({ open: false, loading: false, student: null, activeTab: "1" })}
        footer={null}
        width={850}
        destroyOnHidden
        title={
          detailsModal.student ? (() => {
            let outstanding = 0;
            if (detailsModal.student?.feeCharges) {
              detailsModal.student.feeCharges.forEach((c: any) => {
                if (c.status !== "WAIVED") {
                  c.items?.forEach((i: any) => {
                    if (i.status !== "WAIVED") {
                      outstanding += (parseFloat(i.amount || 0) - parseFloat(i.paidAmount || 0));
                    }
                  });
                }
              });
            }

            return (
              <div className="flex items-center justify-between pr-8">
                <div>
                  <h2 className="text-xl font-bold m-0">{detailsModal.student.name}</h2>
                  <p className="text-sm text-muted-foreground font-normal">
                    {detailsModal.student.class?.name} · {detailsModal.student.section?.name} | Roll No: {detailsModal.student.rollNumber}
                  </p>
                </div>
                {outstanding > 0 && canEdit && detailsModal.activeTab !== "2" && (
                  <button
                    type="button"
                    onClick={() => setDetailsModal((prev) => ({ ...prev, activeTab: "2" }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white hover:bg-violet-700 rounded-lg text-xs font-semibold shadow-sm transition-colors"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Collect Fee ({formatCurrency(outstanding)})
                  </button>
                )}
              </div>
            );
          })() : "Student Details"
        }
      >
        {detailsModal.loading ? (
          <div className="flex justify-center items-center py-20">
            <Spin size="large" />
          </div>
        ) : detailsModal.student ? (() => {
          let outstanding = 0;
          if (detailsModal.student?.feeCharges) {
            detailsModal.student.feeCharges.forEach((c: any) => {
              if (c.status !== "WAIVED") {
                c.items?.forEach((i: any) => {
                  if (i.status !== "WAIVED") {
                    outstanding += (parseFloat(i.amount || 0) - parseFloat(i.paidAmount || 0));
                  }
                });
              }
            });
          }

          return (
            <Tabs
              activeKey={detailsModal.activeTab}
              onChange={(key) => setDetailsModal((prev) => ({ ...prev, activeTab: key }))}
              items={[
                {
                  key: '1',
                  label: 'Details',
                  children: (
                    <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Admission No.</p>
                        <p className="text-sm font-medium">{detailsModal.student.admissionNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Gender</p>
                        <p className="text-sm font-medium">{detailsModal.student.gender}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Date of Birth</p>
                        <p className="text-sm font-medium">
                          {detailsModal.student.dateOfBirth 
                            ? new Date(detailsModal.student.dateOfBirth).toLocaleDateString() 
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Status</p>
                        <p className="text-sm font-medium">{detailsModal.student.isActive ? 'Active' : 'Inactive'}</p>
                      </div>
                      <div className="col-span-2 pt-4 border-t mt-2">
                        <h4 className="text-sm font-bold mb-3">Parent Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Name</p>
                            <p className="text-sm font-medium">{detailsModal.student.parentName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Phone</p>
                            <p className="text-sm font-medium">{detailsModal.student.parentPhone}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Address</p>
                            <p className="text-sm font-medium">{detailsModal.student.address || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: '2',
                  label: outstanding > 0 ? (
                    <span className="flex items-center gap-1.5 font-semibold text-violet-600 dark:text-violet-400">
                      Collect Fee
                      <span className="px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-[10px] text-violet-700 dark:text-violet-300 font-bold">
                        {formatCurrency(outstanding)}
                      </span>
                    </span>
                  ) : (
                    'Collect Fee'
                  ),
                  children: (
                    <div className="max-h-[65vh] overflow-y-auto scrollbar-hide pr-1">
                      <StudentFeeCollection
                        student={detailsModal.student}
                        canEdit={canEdit}
                        onPaymentSuccess={() => refreshStudentDetails(detailsModal.student.id)}
                        onWaiveSuccess={() => refreshStudentDetails(detailsModal.student.id)}
                      />
                    </div>
                  ),
                },
                {
                  key: '3',
                  label: 'Fee History',
                  children: (
                    <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
                      <div className="flex justify-between items-center p-4 bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 rounded-lg mb-6">
                        <span className="font-semibold text-violet-800 dark:text-violet-300">Total Outstanding Due</span>
                        <span className="text-lg font-bold text-violet-900 dark:text-violet-200">{formatCurrency(outstanding)}</span>
                      </div>

                      {detailsModal.student.advanceLedgers && detailsModal.student.advanceLedgers.length > 0 && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900 mb-6">
                          <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-2">Advance Payments</h4>
                          <div className="space-y-2">
                            {detailsModal.student.advanceLedgers.map((ledger: any) => (
                              <div key={ledger.id} className="flex justify-between items-center text-sm">
                                <span className="text-emerald-700 dark:text-emerald-400">{ledger.description || 'Advance Paid'}</span>
                                <span className="font-semibold text-emerald-800 dark:text-emerald-300">{formatCurrency(parseFloat(ledger.amount))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <h4 className="text-sm font-bold">Recent Fee Dues</h4>
                      {detailsModal.student.feeCharges && detailsModal.student.feeCharges.length > 0 ? (
                        <div className="space-y-3">
                          {detailsModal.student.feeCharges.map((charge: any) => {
                            const totalAmount = charge.items?.reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0) || 0;
                            const isExpanded = expandedChargeId === charge.id;
                            return (
                              <div key={charge.id} className="border rounded-lg overflow-hidden">
                                <div 
                                  className="flex justify-between items-center p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                                  onClick={() => setExpandedChargeId(isExpanded ? null : charge.id)}
                                >
                                  <div>
                                    <p className="text-sm font-medium">{charge.title}</p>
                                    <p className="text-xs text-muted-foreground">Due: {new Date(charge.dueDate).toLocaleDateString('default', { month: 'short', year: 'numeric' })}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold">{formatCurrency(totalAmount)}</p>
                                    <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-[10px] font-medium border ${FEE_BADGE[charge.status] ?? FEE_BADGE.PAID}`}>
                                      {charge.status}
                                    </span>
                                  </div>
                                </div>
                                {isExpanded && charge.items && charge.items.length > 0 && (
                                  <div className="bg-muted/20 p-3 border-t text-sm">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="text-xs text-muted-foreground border-b border-muted">
                                          <th className="text-left font-medium pb-2">Component</th>
                                          <th className="text-right font-medium pb-2">Amount</th>
                                          <th className="text-right font-medium pb-2">Paid</th>
                                          <th className="text-right font-medium pb-2">Due</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {charge.items.map((item: any) => {
                                          const amt = parseFloat(item.amount);
                                          const paid = parseFloat(item.paidAmount);
                                          const due = amt - paid;
                                          return (
                                            <tr key={item.id} className="border-b border-muted/50 last:border-0">
                                              <td className="py-2 text-muted-foreground">{item.component?.name || 'Fee'}</td>
                                              <td className="py-2 text-right">{formatCurrency(amt)}</td>
                                              <td className="py-2 text-right text-emerald-600">{formatCurrency(paid)}</td>
                                              <td className={`py-2 text-right font-medium ${due > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                                {formatCurrency(due)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg bg-muted/20">No fee dues found.</p>
                      )}

                      <h4 className="text-sm font-bold mt-6">Recent Transactions</h4>
                      {detailsModal.student.paymentTxs && detailsModal.student.paymentTxs.length > 0 ? (
                        <div className="space-y-3 mt-3">
                          {detailsModal.student.paymentTxs.map((tx: any) => (
                            <div key={tx.id} className="flex justify-between items-center p-3 border rounded-lg">
                              <div>
                                <p className="text-sm font-medium">{tx.receiptNo}</p>
                                <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString()} · {tx.method}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(parseFloat(tx.amount))}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg bg-muted/20 mt-3">No recent transactions found.</p>
                      )}
                    </div>
                  ),
                },
                {
                  key: '4',
                  label: 'Performance',
                  children: (
                    <div className="flex items-center justify-center py-20 text-muted-foreground text-sm max-h-[60vh] overflow-y-auto scrollbar-hide">
                      Performance details are not available at this time.
                    </div>
                  ),
                },
              ]}
            />
          );
        })() : null}
      </Modal>
      </div>
    </ConfigProvider>
  );
}
