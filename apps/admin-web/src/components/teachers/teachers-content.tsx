"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  MoreVertical,
  GraduationCap,
  Briefcase,
  Users,
  Phone,
  Mail,
  IndianRupee,
  Calendar,
  Filter,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useQueryTab, useQueryState } from "@/hooks/use-query-state";
import { TeacherDialog } from "./teacher-dialog";
import { StaffDialog } from "./staff-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTeacher } from "@/lib/actions/teachers";
import { deleteStaff } from "@/lib/actions/staff";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { formatCurrency } from "@schoolos/utils";

interface Props {
  teachers: any[];
  staffList?: any[];
  classes: {
    id: string;
    name: string;
    sections: { id: string; name: string }[];
  }[];
}

const OCCUPATION_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  Accountant: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  Driver: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  Sweeper: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
  },
  Peon: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  "Security Guard": {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
  },
  "Bus Conductor": {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
  },
  Librarian: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-800",
  },
};

export function TeachersContent({
  teachers,
  staffList = [],
  classes,
}: Readonly<Props>) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useQueryTab<"teachers" | "staff">({
    paramKey: "tab",
    validTabs: ["teachers", "staff"],
    defaultTab: "teachers",
  });
  const [search, setSearch] = useQueryState("q", "");
  const [selectedOccupation, setSelectedOccupation] = useQueryState(
    "occupation",
    "ALL",
  );

  // Teacher Dialog & Delete States
  const [teacherDialog, setTeacherDialog] = useState<
    "closed" | "create" | "edit"
  >("closed");
  const [editTeacher, setEditTeacher] = useState<any>(null);
  const [deleteTeacherTarget, setDeleteTeacherTarget] = useState<any>(null);

  // Staff Dialog & Delete States
  const [staffDialog, setStaffDialog] = useState<"closed" | "create" | "edit">(
    "closed",
  );
  const [editStaff, setEditStaff] = useState<any>(null);
  const [deleteStaffTarget, setDeleteStaffTarget] = useState<any>(null);

  // Teacher filtering
  const filteredTeachers = teachers.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      (t.phone && t.phone.toLowerCase().includes(q))
    );
  });

  // Staff filtering
  const staffOccupations = Array.from(
    new Set(staffList.map((s) => s.occupation).filter(Boolean)),
  );

  const filteredStaff = staffList.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      s.occupation.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q) ||
      (s.qualification && s.qualification.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q));

    const matchesOccupation =
      selectedOccupation === "ALL" || s.occupation === selectedOccupation;

    return matchesSearch && matchesOccupation;
  });

  const handleDeleteTeacher = async () => {
    const result = await deleteTeacher(deleteTeacherTarget.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Teacher removed");
      router.refresh();
    }
  };

  const handleDeleteStaff = async () => {
    const result = await deleteStaff(deleteStaffTarget.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Staff member removed");
      router.refresh();
    }
  };

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Teachers & Staff
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your school's faculty and non-teaching support personnel
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === "teachers" ? (
            <button
              type="button"
              onClick={() => setTeacherDialog("create")}
              className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Teacher
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStaffDialog("create")}
              className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Staff Member
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b">
        <button
          type="button"
          onClick={() => {
            setActiveTab("teachers");
            setSearch("");
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "teachers"
              ? "border-violet-600 text-violet-600 dark:text-violet-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Teachers
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === "teachers"
                ? "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 font-bold"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {teachers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("staff");
            setSearch("");
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "staff"
              ? "border-violet-600 text-violet-600 dark:text-violet-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Support Staff
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === "staff"
                ? "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 font-bold"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {staffList.length}
          </span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            aria-label={`Search ${activeTab}`}
            placeholder={
              activeTab === "teachers"
                ? "Search teachers by name, subject, email..."
                : "Search staff by name, occupation, phone, qualification..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Staff Occupation Filter Pills */}
        {activeTab === "staff" && staffOccupations.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" /> Role:
            </span>
            <button
              type="button"
              onClick={() => setSelectedOccupation("ALL")}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                selectedOccupation === "ALL"
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-background hover:bg-muted text-muted-foreground border-border"
              }`}
            >
              All Roles ({staffList.length})
            </button>
            {staffOccupations.map((occ) => (
              <button
                key={occ}
                type="button"
                onClick={() => setSelectedOccupation(occ)}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                  selectedOccupation === occ
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-background hover:bg-muted text-muted-foreground border-border"
                }`}
              >
                {occ}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content for TAB 1: TEACHERS */}
      {activeTab === "teachers" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTeachers.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
              className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                      {t.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {t.subject}
                      </p>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Teacher actions"
                          className="p-1 rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/20 data-[state=open]:bg-muted"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditTeacher(t);
                            setTeacherDialog("edit");
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteTeacherTarget(t)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                  <p className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" /> {t.email}
                  </p>
                  {t.phone && (
                    <p className="flex items-center gap-2 truncate">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {t.phone}
                    </p>
                  )}
                  {t.qualification && (
                    <p className="flex items-center gap-2 truncate text-[11px] text-muted-foreground">
                      <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />{" "}
                      {t.qualification}
                    </p>
                  )}
                  {t.salary && (
                    <p className="flex items-center gap-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <IndianRupee className="w-3.5 h-3.5 flex-shrink-0" />
                      {formatCurrency(Number(t.salary))}/month
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                {t.classTeacherOf && t.classTeacherOf.length > 0 && (
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                      <Award className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      Class Teacher:{" "}
                      {t.classTeacherOf.map((c: any) => c.name).join(", ")}
                    </span>
                  </div>
                )}

                {t.assignedSections && t.assignedSections.length > 0 ? (
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mr-0.5">
                      <GraduationCap className="w-3 h-3" /> Classes:
                    </span>
                    {t.assignedSections.map((as: any) => (
                      <span
                        key={as.id || `${as.classId}-${as.sectionId}`}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800"
                      >
                        {as.class?.name || "Class"} ·{" "}
                        {as.section?.name || "Sec"}
                      </span>
                    ))}
                  </div>
                ) : t.assignedClass?.name ? (
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800">
                      <GraduationCap className="w-2.5 h-2.5" />
                      Class: {t.assignedClass.name} ·{" "}
                      {t.assignedSection?.name ?? "—"}
                    </span>
                  </div>
                ) : null}

                {t.joiningDate && (
                  <p className="text-[10px] text-muted-foreground flex items-center justify-between pt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Joined:
                    </span>
                    <span>
                      {new Date(t.joiningDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </p>
                )}
              </div>
            </motion.div>
          ))}

          {filteredTeachers.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 text-center border rounded-xl bg-card">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <GraduationCap className="w-6 h-6 text-muted-foreground opacity-50" />
              </div>
              <p className="text-sm font-semibold mb-1">
                {search
                  ? "No teachers match your search"
                  : "No teachers added yet"}
              </p>
              <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                {search
                  ? "Try searching by a different name, email, or subject."
                  : "Add your school's faculty members to manage class assignments."}
              </p>
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="h-8 px-4 border rounded-lg text-xs hover:bg-muted transition-colors font-medium"
                >
                  Clear search
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setTeacherDialog("create")}
                  className="flex items-center gap-2 h-8 px-4 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Teacher
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content for TAB 2: SUPPORT STAFF */}
      {activeTab === "staff" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStaff.map((s, i) => {
            const occStyle = OCCUPATION_COLORS[s.occupation] || {
              bg: "bg-muted/60",
              text: "text-foreground",
              border: "border-border",
            };

            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-sm font-bold text-violet-700 dark:text-violet-300 flex-shrink-0">
                        {s.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {s.name}
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border mt-0.5 ${occStyle.bg} ${occStyle.text} ${occStyle.border}`}
                        >
                          {s.occupation}
                        </span>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Staff actions"
                            className="p-1 rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/20 data-[state=open]:bg-muted"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditStaff(s);
                              setStaffDialog("edit");
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteStaffTarget(s)}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Staff Info Details */}
                  <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <a href={`tel:${s.phone}`} className="hover:underline">
                        {s.phone}
                      </a>
                    </p>

                    {s.qualification && (
                      <p className="flex items-center gap-2 text-[11px]">
                        <GraduationCap className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{s.qualification}</span>
                      </p>
                    )}

                    {s.email && (
                      <p className="flex items-center gap-2 truncate text-[11px]">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" /> {s.email}
                      </p>
                    )}

                    {s.salary && (
                      <p className="flex items-center gap-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <IndianRupee className="w-3.5 h-3.5 flex-shrink-0" />
                        {formatCurrency(Number(s.salary))}/month
                      </p>
                    )}
                  </div>
                </div>

                {s.joiningDate && (
                  <div className="pt-2 border-t text-[10px] text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Joined:
                    </span>
                    <span>
                      {new Date(s.joiningDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}

          {filteredStaff.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 text-center border rounded-xl bg-card">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6 text-muted-foreground opacity-50" />
              </div>
              <p className="text-sm font-semibold mb-1">
                {search || selectedOccupation !== "ALL"
                  ? "No staff members match your criteria"
                  : "No support staff added yet"}
              </p>
              <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                {search || selectedOccupation !== "ALL"
                  ? "Try resetting your search or occupation filter."
                  : "Add your non-teaching support personnel (Drivers, Sweepers, Peons, Accountants, etc.)."}
              </p>
              {search || selectedOccupation !== "ALL" ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedOccupation("ALL");
                  }}
                  className="h-8 px-4 border rounded-lg text-xs hover:bg-muted transition-colors font-medium"
                >
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStaffDialog("create")}
                  className="flex items-center gap-2 h-8 px-4 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Staff Member
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Teacher Add/Edit Modal */}
      <TeacherDialog
        open={teacherDialog !== "closed"}
        onOpenChange={(open) => {
          if (!open) {
            setTeacherDialog("closed");
            setEditTeacher(null);
          }
        }}
        teacher={editTeacher}
        classes={classes}
      />

      {/* Staff Add/Edit Modal */}
      <StaffDialog
        open={staffDialog !== "closed"}
        onOpenChange={(open) => {
          if (!open) {
            setStaffDialog("closed");
            setEditStaff(null);
          }
        }}
        staff={editStaff}
      />

      {/* Confirm Delete Teacher Modal */}
      <ConfirmDialog
        open={!!deleteTeacherTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTeacherTarget(null);
        }}
        title="Remove Teacher"
        description={`Remove ${deleteTeacherTarget?.name}? Their login will be deactivated. Existing records are preserved.`}
        confirmLabel="Remove"
        onConfirm={handleDeleteTeacher}
      />

      {/* Confirm Delete Staff Modal */}
      <ConfirmDialog
        open={!!deleteStaffTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteStaffTarget(null);
        }}
        title="Remove Staff Member"
        description={`Remove ${deleteStaffTarget?.name} (${deleteStaffTarget?.occupation})?`}
        confirmLabel="Remove"
        onConfirm={handleDeleteStaff}
      />
    </div>
  );
}
