"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  ConfigProvider,
  theme as antTheme,
  Segmented,
  Select,
  Button,
  Card,
  Badge,
  Tooltip,
  message,
} from "antd";
import { useTheme } from "next-themes";
import {
  Calendar,
  Clock,
  Sparkles,
  Plus,
  Settings2,
  ShieldAlert,
  Printer,
  BookOpen,
  Users,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { TimetableGrid } from "./timetable-grid";
import { TimetableSkeleton } from "./timetable-skeleton";
import { SlotDialog } from "./slot-dialog";
import { AutoGeneratorModal } from "./auto-generator-modal";
import { PeriodSettingsModal } from "./period-settings-modal";
import { ConflictAuditModal } from "./conflict-audit-modal";
import {
  getTimetable,
  getTimetablePeriods,
  saveTimetableSlot,
  deleteTimetableSlot,
  auditSchoolConflicts,
} from "@/lib/actions/timetable";
import { PeriodDefinition } from "@/lib/timetable-generator";

interface TimetableContentProps {
  schoolName?: string;
  initialClasses: any[];
  initialTeachers: any[];
  initialPeriods: PeriodDefinition[];
  initialSlots: any[];
  userRole?: string;
}

export function TimetableContent({
  schoolName,
  initialClasses,
  initialTeachers,
  initialPeriods,
  initialSlots,
  userRole,
}: TimetableContentProps) {
  const { theme } = useTheme();

  // Mode: class vs teacher perspective
  const [viewMode, setViewMode] = useState<"class" | "teacher">("class");

  // Selection states
  const [selectedClassId, setSelectedClassId] = useState<string>(
    initialClasses[0]?.id || "",
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    initialClasses[0]?.sections?.[0]?.id || "",
  );
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    initialTeachers[0]?.id || "",
  );

  // Data states
  const [periods, setPeriods] = useState<PeriodDefinition[]>(initialPeriods);
  const [slots, setSlots] = useState<any[]>(initialSlots);
  const [loading, setLoading] = useState(false);
  const [conflictCount, setConflictCount] = useState<number>(0);

  // Dialog states
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [selectedSlotForEdit, setSelectedSlotForEdit] = useState<any>(null);
  const [defaultDayForAdd, setDefaultDayForAdd] = useState<number>(1);
  const [defaultPeriodForAdd, setDefaultPeriodForAdd] = useState<number>(1);

  const [autoGenOpen, setAutoGenOpen] = useState(false);
  const [periodSettingsOpen, setPeriodSettingsOpen] = useState(false);
  const [conflictAuditOpen, setConflictAuditOpen] = useState(false);

  const isInitialMount = useRef(true);
  const activeRequestIdRef = useRef(0);

  // Sections for the selected class
  const activeClass = useMemo(
    () => initialClasses.find((c) => c.id === selectedClassId),
    [initialClasses, selectedClassId],
  );
  const sections = activeClass?.sections || [];

  // Update selectedSectionId if selectedClassId changes and current section not in class
  useEffect(() => {
    if (
      sections.length > 0 &&
      !sections.some((s: any) => s.id === selectedSectionId)
    ) {
      setSelectedSectionId(sections[0].id);
    }
  }, [selectedClassId, sections, selectedSectionId]);

  // Fetch slots based on view mode and selection
  const refreshSlots = useCallback(async () => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const currentRequestId = ++activeRequestIdRef.current;
    setLoading(true);
    try {
      if (viewMode === "class") {
        if (!selectedSectionId) {
          if (activeRequestIdRef.current === currentRequestId) {
            setSlots([]);
          }
          return;
        }
        const data = await getTimetable({ sectionId: selectedSectionId });
        if (activeRequestIdRef.current === currentRequestId) {
          setSlots(data);
        }
      } else {
        if (!selectedTeacherId) {
          if (activeRequestIdRef.current === currentRequestId) {
            setSlots([]);
          }
          return;
        }
        const data = await getTimetable({ teacherId: selectedTeacherId });
        if (activeRequestIdRef.current === currentRequestId) {
          setSlots(data);
        }
      }
    } catch {
      if (activeRequestIdRef.current === currentRequestId) {
        message.error("Failed to load timetable slots.");
      }
    } finally {
      if (activeRequestIdRef.current === currentRequestId) {
        setLoading(false);
      }
    }
  }, [viewMode, selectedSectionId, selectedTeacherId]);

  useEffect(() => {
    refreshSlots();
  }, [refreshSlots]);

  // Check school-wide conflicts count
  const checkConflictCount = useCallback(async () => {
    try {
      const conflicts = await auditSchoolConflicts();
      setConflictCount(conflicts.length);
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    checkConflictCount();
  }, [checkConflictCount]);

  const refreshPeriods = async () => {
    try {
      const p = await getTimetablePeriods();
      setPeriods(p as any);
    } catch {
      message.error("Failed to refresh period settings.");
    }
  };

  // Actions
  const handleOpenAddSlot = (dayOfWeek: number, periodNumber: number) => {
    setSelectedSlotForEdit(null);
    setDefaultDayForAdd(dayOfWeek);
    setDefaultPeriodForAdd(periodNumber);
    setSlotDialogOpen(true);
  };

  const handleOpenEditSlot = (slot: any) => {
    setSelectedSlotForEdit(slot);
    setSlotDialogOpen(true);
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await deleteTimetableSlot(slotId);
      message.success("Class removed from schedule.");
      refreshSlots();
      checkConflictCount();
    } catch (err: any) {
      message.error(err.message || "Failed to remove class.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isTeacherRole = userRole === "TEACHER";

  // KPIs
  const totalClassesScheduled = slots.length;
  const uniqueTeachersCount = useMemo(() => {
    const set = new Set(slots.map((s) => s.teacherId).filter(Boolean));
    return set.size;
  }, [slots]);

  const currentTargetName = useMemo(() => {
    if (viewMode === "class") {
      const sec = sections.find((s: any) => s.id === selectedSectionId);
      return `${activeClass?.name || "Class"} ${sec ? `— Section ${sec.name}` : ""}`;
    }
    const tch = initialTeachers.find((t) => t.id === selectedTeacherId);
    return tch ? `${tch.name}'s Schedule` : "Teacher Schedule";
  }, [
    viewMode,
    activeClass,
    sections,
    selectedSectionId,
    initialTeachers,
    selectedTeacherId,
  ]);

  return (
    <ConfigProvider
      theme={{
        algorithm:
          theme === "dark" ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#7c3aed",
          borderRadius: 10,
        },
      }}
    >
      <div className="p-6 md:p-8 space-y-6 pb-12 print:p-0 print:space-y-0 print:m-0 print:pb-0">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Calendar className="w-7 h-7 text-violet-600" />
              <span>Timetable & Scheduling</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automated and manual class scheduling with real-time teacher and
              venue conflict prevention.
            </p>
          </div>

          {/* Quick Actions */}
          {!isTeacherRole && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tooltip title="Audit School Conflicts">
                <Button
                  icon={<ShieldAlert className="w-4 h-4" />}
                  onClick={() => setConflictAuditOpen(true)}
                  className={`rounded-xl ${
                    conflictCount > 0
                      ? "border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      : ""
                  }`}
                >
                  Conflicts
                  {conflictCount > 0 && (
                    <Badge count={conflictCount} className="ml-1" />
                  )}
                </Button>
              </Tooltip>

              <Tooltip title="Configure Periods & Breaks">
                <Button
                  icon={<Settings2 className="w-4 h-4" />}
                  onClick={() => setPeriodSettingsOpen(true)}
                  className="rounded-xl"
                >
                  Bell Schedule
                </Button>
              </Tooltip>

              <Tooltip title="Print Timetable">
                <Button
                  icon={<Printer className="w-4 h-4" />}
                  onClick={handlePrint}
                  className="rounded-xl"
                >
                  Print
                </Button>
              </Tooltip>

              <Button
                type="primary"
                icon={<Sparkles className="w-4 h-4" />}
                onClick={() => setAutoGenOpen(true)}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
              >
                Auto-Generate
              </Button>

              <Button
                type="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => handleOpenAddSlot(1, 1)}
                className="bg-violet-600 hover:bg-violet-700 rounded-xl"
              >
                Schedule Class
              </Button>
            </div>
          )}
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
          <Card className="rounded-2xl border bg-card shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Scheduled Classes
                </p>
                <h3 className="text-xl font-bold text-foreground mt-0.5">
                  {loading ? (
                    <span className="inline-block w-8 h-6 bg-muted animate-pulse rounded" />
                  ) : (
                    totalClassesScheduled
                  )}
                </h3>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Teachers Scheduled
                </p>
                <h3 className="text-xl font-bold text-foreground mt-0.5">
                  {loading ? (
                    <span className="inline-block w-8 h-6 bg-muted animate-pulse rounded" />
                  ) : (
                    uniqueTeachersCount
                  )}
                </h3>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Daily Periods
                </p>
                <h3 className="text-xl font-bold text-foreground mt-0.5">
                  {periods.filter((p) => !p.isBreak).length}
                </h3>
              </div>
            </div>
          </Card>

          <Card
            className={`rounded-2xl border bg-card shadow-xs cursor-pointer transition-all hover:border-violet-300 ${
              conflictCount > 0 ? "border-red-300 dark:border-red-800" : ""
            }`}
            onClick={() => setConflictAuditOpen(true)}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  conflictCount > 0
                    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                    : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                }`}
              >
                {conflictCount > 0 ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Conflict Status
                </p>
                <h3
                  className={`text-sm font-bold mt-0.5 ${
                    conflictCount > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {conflictCount > 0
                    ? `${conflictCount} Clashes Found`
                    : "All Clear (0 Clashes)"}
                </h3>
              </div>
            </div>
          </Card>
        </div>

        {/* View Mode & Selection Controls */}
        <div className="bg-card border rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3 flex-wrap">
            <Segmented
              value={viewMode}
              onChange={(val) => {
                setViewMode(val as "class" | "teacher");
                setLoading(true);
              }}
              options={[
                {
                  label: "Class Timetable",
                  value: "class",
                  icon: <BookOpen className="w-4 h-4 inline mr-1" />,
                },
                {
                  label: "Teacher Schedule",
                  value: "teacher",
                  icon: <Users className="w-4 h-4 inline mr-1" />,
                },
              ]}
              className="bg-muted p-1 rounded-xl"
            />

            {viewMode === "class" ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={selectedClassId}
                  loading={loading}
                  onChange={(val) => {
                    const c = initialClasses.find((cls) => cls.id === val);
                    const firstSec = c?.sections?.[0]?.id || "";
                    setLoading(true);
                    setSelectedClassId(val);
                    setSelectedSectionId(firstSec);
                  }}
                  options={initialClasses.map((c) => ({
                    label: c.name,
                    value: c.id,
                  }))}
                  placeholder="Select Class"
                  className="w-40"
                />

                <Select
                  value={selectedSectionId}
                  loading={loading}
                  onChange={(val) => {
                    setLoading(true);
                    setSelectedSectionId(val);
                  }}
                  options={sections.map((s: any) => ({
                    label: `Section ${s.name}`,
                    value: s.id,
                  }))}
                  placeholder="Select Section"
                  className="w-36"
                />
              </div>
            ) : (
              <Select
                showSearch
                value={selectedTeacherId}
                loading={loading}
                onChange={(val) => {
                  setLoading(true);
                  setSelectedTeacherId(val);
                }}
                options={initialTeachers.map((t) => ({
                  label: `${t.name} (${t.subject || "General"})`,
                  value: t.id,
                }))}
                placeholder="Select Teacher"
                optionFilterProp="label"
                className="w-64"
              />
            )}
          </div>

          <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
            <span>Showing:</span>
            {loading ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-violet-600 dark:text-violet-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Switching...</span>
              </span>
            ) : (
              <span className="font-semibold text-foreground">
                {viewMode === "class"
                  ? `${activeClass?.name || "Class"} — Section ${
                      sections.find((s: any) => s.id === selectedSectionId)
                        ?.name || "A"
                    }`
                  : initialTeachers.find((t) => t.id === selectedTeacherId)
                      ?.name || "Teacher"}
              </span>
            )}
          </div>
        </div>

        {/* Print-Only Official Timetable Header */}
        <div className="hidden print:block mb-3 pb-2 border-b-2 border-black">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-black tracking-tight uppercase">
                {schoolName || "SchoolOS"}
              </h1>
              <p className="text-sm font-semibold text-black mt-0.5">
                {currentTargetName} · Academic Timetable
              </p>
            </div>
            <div className="text-right text-xs text-black">
              <div className="font-semibold text-black">
                Academic Year 2024–2025
              </div>
              <div className="text-[11px] text-gray-700 mt-0.5">
                Generated:{" "}
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Timetable Grid Matrix */}
        <div className="print:m-0 print:w-full">
          {loading ? (
            <TimetableSkeleton
              periods={periods}
              targetName={currentTargetName}
            />
          ) : (
            <TimetableGrid
              mode={viewMode}
              periods={periods}
              slots={slots}
              onAddSlot={handleOpenAddSlot}
              onEditSlot={handleOpenEditSlot}
              onDeleteSlot={handleDeleteSlot}
              isReadOnly={isTeacherRole}
            />
          )}
        </div>

        {/* Modals */}
        <SlotDialog
          open={slotDialogOpen}
          onClose={() => setSlotDialogOpen(false)}
          onSave={async (data) => {
            const res = await saveTimetableSlot(data);
            if (res.success) {
              refreshSlots();
              checkConflictCount();
            }
            return res;
          }}
          initialData={selectedSlotForEdit}
          classes={initialClasses}
          teachers={initialTeachers}
          periods={periods}
          selectedClassId={selectedClassId}
          selectedSectionId={selectedSectionId}
          defaultDayOfWeek={defaultDayForAdd}
          defaultPeriodNumber={defaultPeriodForAdd}
        />

        <AutoGeneratorModal
          open={autoGenOpen}
          onClose={() => setAutoGenOpen(false)}
          classes={initialClasses}
          teachers={initialTeachers}
          periods={periods}
          selectedClassId={selectedClassId}
          selectedSectionId={selectedSectionId}
          onGenerated={() => {
            refreshSlots();
            checkConflictCount();
          }}
        />

        <PeriodSettingsModal
          open={periodSettingsOpen}
          onClose={() => setPeriodSettingsOpen(false)}
          periods={periods}
          onSaved={() => {
            refreshPeriods();
            refreshSlots();
          }}
        />

        <ConflictAuditModal
          open={conflictAuditOpen}
          onClose={() => setConflictAuditOpen(false)}
          onResolved={() => {
            refreshSlots();
            checkConflictCount();
          }}
        />
      </div>
    </ConfigProvider>
  );
}
