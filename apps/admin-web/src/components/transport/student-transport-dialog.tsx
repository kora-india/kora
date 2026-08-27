"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Dialog } from "@/components/ui/dialog";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { Button } from "@schoolos/ui";
import { TransportTripType, TransportEnrollmentStatus } from "@schoolos/db";
import { enrollStudentTransport } from "@/lib/actions/transport";
import { searchStudents } from "@/lib/actions/students";
import { Select, Tag, ConfigProvider, theme as antTheme } from "antd";
import { useTheme } from "next-themes";
import { Calculator, Loader2, Phone, Search, User } from "lucide-react";

interface StudentTransportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routes: any[];
  initialEnrollment?: any;
  onSuccess: () => void;
}

export function StudentTransportDialog({
  open,
  onOpenChange,
  routes,
  initialEnrollment,
  onSuccess,
}: Readonly<StudentTransportDialogProps>) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Student search state
  const [studentId, setStudentId] = useState(initialEnrollment?.studentId || "");
  const [studentList, setStudentList] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Route & allocation form state
  const [routeId, setRouteId] = useState(initialEnrollment?.routeId || (routes[0]?.id || ""));
  const [stopId, setStopId] = useState(initialEnrollment?.stopId || "");
  const [tripType, setTripType] = useState<TransportTripType>(
    initialEnrollment?.tripType || TransportTripType.TWO_WAY
  );
  const [distanceKm, setDistanceKm] = useState(
    initialEnrollment?.distanceKm ? String(initialEnrollment.distanceKm) : "0"
  );
  const [customFee, setCustomFee] = useState<string | null>(
    initialEnrollment?.monthlyFee ? String(initialEnrollment.monthlyFee) : null
  );
  const [notes, setNotes] = useState(initialEnrollment?.notes || "");

  // Debounced search query function
  const performSearch = useCallback(async (query: string) => {
    setIsSearching(true);
    try {
      const res = await searchStudents(query, 30);
      if (res.success && res.students) {
        setStudentList(res.students);
      }
    } catch (err) {
      console.error("Failed to search students:", err);
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      searchTimerRef.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    },
    [performSearch]
  );

  // Sync state on open / initialEnrollment change
  useEffect(() => {
    if (open) {
      if (initialEnrollment) {
        setStudentId(initialEnrollment.studentId || "");
        setRouteId(initialEnrollment.routeId || routes[0]?.id || "");
        setStopId(initialEnrollment.stopId || "");
        setTripType(initialEnrollment.tripType || TransportTripType.TWO_WAY);
        setDistanceKm(
          initialEnrollment.distanceKm ? String(initialEnrollment.distanceKm) : "0"
        );
        setCustomFee(
          initialEnrollment.monthlyFee ? String(initialEnrollment.monthlyFee) : null
        );
        setNotes(initialEnrollment.notes || "");
        if (initialEnrollment.student) {
          setStudentList([initialEnrollment.student]);
        }
      } else {
        setStudentId("");
        const defaultRoute = routes[0];
        setRouteId(defaultRoute?.id || "");
        const defaultStop = defaultRoute?.stops?.[0];
        setStopId(defaultStop?.id || "");
        setTripType(TransportTripType.TWO_WAY);
        setDistanceKm(
          defaultStop?.distanceFromSchoolKm
            ? String(defaultStop.distanceFromSchoolKm)
            : "0"
        );
        setCustomFee(null);
        setNotes("");
        // Load initial batch of active students on open
        performSearch("");
      }
      setError(null);
    }

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [open, initialEnrollment, routes, performSearch]);

  // Selected Route & Stops
  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === routeId),
    [routes, routeId]
  );
  const availableStops = useMemo(
    () => selectedRoute?.stops || [],
    [selectedRoute]
  );

  const handleRouteChange = (newRouteId: string) => {
    setRouteId(newRouteId);
    const r = routes.find((route) => route.id === newRouteId);
    if (r?.stops?.length) {
      setStopId(r.stops[0].id);
      setDistanceKm(String(r.stops[0].distanceFromSchoolKm || "0"));
    } else {
      setStopId("");
      setDistanceKm("0");
    }
  };

  const handleStopChange = (newStopId: string) => {
    setStopId(newStopId);
    const s = availableStops.find((stop: any) => stop.id === newStopId);
    if (s) {
      setDistanceKm(String(s.distanceFromSchoolKm || "0"));
    }
  };

  // Calculate Monthly Fee
  const calculatedFee = useMemo(() => {
    if (!selectedRoute) return 0;
    if (selectedRoute.flatRate && Number(selectedRoute.flatRate) > 0) {
      return Number(selectedRoute.flatRate);
    }

    const dist = Number(distanceKm) || 0;
    const ratePerKm = Number(selectedRoute.defaultRatePerKm) || 100;
    let multiplier = 1.0;
    if (
      tripType === TransportTripType.PICKUP_ONLY ||
      tripType === TransportTripType.DROP_ONLY
    ) {
      multiplier = 0.6;
    }

    return Math.round(dist * ratePerKm * multiplier);
  }, [selectedRoute, distanceKm, tripType]);

  const activeMonthlyFee =
    customFee !== null ? Number(customFee) : calculatedFee;

  // Options for AntD Select
  const studentOptions = useMemo(() => {
    const list = [...studentList];
    if (
      initialEnrollment?.student &&
      !list.some((s) => s.id === initialEnrollment.student.id)
    ) {
      list.unshift(initialEnrollment.student);
    }

    return list.map((s: any) => {
      const classSection = [s.class?.name, s.section?.name]
        .filter(Boolean)
        .join(" - ");
      return {
        value: s.id,
        label: `${s.name} (${classSection || "Class"} • Roll: ${s.rollNumber || "N/A"})`,
        student: s,
      };
    });
  }, [studentList, initialEnrollment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !routeId || !stopId) {
      setError("Please select student, route, and stop.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await enrollStudentTransport({
        studentId,
        routeId,
        stopId,
        vehicleId: selectedRoute?.vehicleId || null,
        tripType,
        distanceKm: Number(distanceKm),
        monthlyFee: activeMonthlyFee,
        status: TransportEnrollmentStatus.ACTIVE,
        notes: notes || undefined,
      });

      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to enroll student in transport");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        initialEnrollment
          ? "Edit Transport Enrollment"
          : "Enroll Student in Transport"
      }
      description="Opt student into school transport with automated distance-based monthly fee calculation."
    >
      <ConfigProvider
        theme={{
          algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: {
            colorPrimary: "#6366f1",
            borderRadius: 8,
            fontFamily: "inherit",
            colorBgContainer: isDark ? "#18181b" : "#ffffff",
            colorBgElevated: isDark ? "#1f1f23" : "#ffffff",
            colorBorder: isDark ? "#27272a" : "#e4e4e7",
            colorBorderSecondary: isDark ? "#27272a" : "#f4f4f5",
            colorText: isDark ? "#f4f4f5" : "#09090b",
            colorTextSecondary: isDark ? "#a1a1aa" : "#71717a",
          },
        }}
      >
        {error && (
          <div className="p-3 mb-4 text-xs rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Select Student" required>
            <Select
              showSearch
              value={studentId || undefined}
              placeholder="Search student by name, roll no, admission no..."
              defaultActiveFirstOption={false}
              filterOption={false}
              onSearch={handleSearch}
              onChange={(val) => setStudentId(val || "")}
              disabled={Boolean(initialEnrollment)}
              allowClear
              loading={isSearching}
              getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
              dropdownStyle={{ maxHeight: 260, overflowY: "auto" }}
              virtual={false}
              className="w-full h-10"
              dropdownRender={(menu) => (
                <div
                  onWheel={(e) => e.stopPropagation()}
                  style={{ maxHeight: 260, overflowY: "auto" }}
                >
                  {menu}
                </div>
              )}
              notFoundContent={
                isSearching ? (
                  <div className="flex items-center justify-center gap-2 p-3 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                    <span>Searching students...</span>
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    {hasSearched
                      ? "No matching students found."
                      : "Type name or roll number to search..."}
                  </div>
                )
              }
              options={studentOptions}
              optionRender={(option) => {
                const s = option.data.student;
                if (!s) return option.label;
                const classSection = [s.class?.name, s.section?.name]
                  .filter(Boolean)
                  .join(" - ");
                return (
                  <div className="flex items-center justify-between py-1 px-1">
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {s.name}
                        </span>
                        {classSection && (
                          <Tag
                            color="blue"
                            className="text-[10px] leading-4 px-1.5 py-0 m-0 border-0 rounded font-medium"
                          >
                            {classSection}
                          </Tag>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Roll:{" "}
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {s.rollNumber || "-"}
                        </span>
                        {s.admissionNumber && (
                          <>
                            {" "}
                            • Adm:{" "}
                            <span className="font-mono text-slate-700 dark:text-slate-300">
                              {s.admissionNumber}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {s.parentPhone && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono shrink-0 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5 text-slate-400" />
                        {s.parentPhone}
                      </span>
                    )}
                  </div>
                );
              }}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Assigned Route" required>
              <select
                value={routeId}
                onChange={(e) => handleRouteChange(e.target.value)}
                className={selectCls}
              >
                {routes.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.code ? `(${r.code})` : ""}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Pickup / Drop Stop" required>
              <select
                value={stopId}
                onChange={(e) => handleStopChange(e.target.value)}
                className={selectCls}
              >
                {availableStops.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    Stop {s.sequenceOrder}: {s.stopName} (
                    {s.distanceFromSchoolKm} km)
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Trip Type">
              <select
                value={tripType}
                onChange={(e) => setTripType(e.target.value as TransportTripType)}
                className={selectCls}
              >
                <option value={TransportTripType.TWO_WAY}>
                  Round Trip (Two-Way 100%)
                </option>
                <option value={TransportTripType.PICKUP_ONLY}>
                  Morning Pickup Only (60%)
                </option>
                <option value={TransportTripType.DROP_ONLY}>
                  Afternoon Drop Only (60%)
                </option>
              </select>
            </FormField>

            <FormField label="Distance from School (km)" required>
              <input
                type="number"
                step="0.1"
                min={0}
                required
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className={inputCls}
              />
            </FormField>
          </div>

          {/* Live Calculation Preview */}
          <div className="p-3.5 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border border-indigo-100 dark:border-indigo-900 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                <Calculator className="h-3.5 w-3.5 text-indigo-600" />
                Monthly Transport Fee
              </span>
              <span className="text-lg font-extrabold text-indigo-700 dark:text-indigo-300">
                ₹{activeMonthlyFee.toLocaleString("en-IN")}/mo
              </span>
            </div>

            <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80">
              {selectedRoute?.flatRate
                ? "Flat Route Pricing applied."
                : `Calculated from ${distanceKm || 0} km × ₹${
                    selectedRoute?.defaultRatePerKm || 100
                  }/km ${
                    tripType !== TransportTripType.TWO_WAY
                      ? "(60% One-way)"
                      : ""
                  }`}
            </p>

            <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-900/50 flex items-center justify-between gap-2">
              <label className="text-[11px] text-slate-600 dark:text-slate-400">
                Manual Fee Override (₹):
              </label>
              <input
                type="number"
                min={0}
                placeholder={`Auto (₹${calculatedFee})`}
                value={customFee ?? ""}
                onChange={(e) =>
                  setCustomFee(e.target.value ? e.target.value : null)
                }
                className={`${inputCls} h-7 w-32 text-xs bg-white dark:bg-slate-900`}
              />
            </div>
          </div>

          <FormField label="Notes / Special Instructions">
            <input
              placeholder="e.g. Sibling travelling together, special drop instructions"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputCls}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialEnrollment ? "Save Changes" : "Confirm Enrollment"}
            </Button>
          </div>
        </form>
      </ConfigProvider>
    </Dialog>
  );
}
