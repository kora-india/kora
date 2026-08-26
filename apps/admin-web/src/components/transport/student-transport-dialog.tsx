"use client";

import { useState, useMemo } from "react";
import { Dialog } from "@/components/ui/dialog";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { Button } from "@schoolos/ui";
import { TransportTripType, TransportEnrollmentStatus } from "@schoolos/db";
import { enrollStudentTransport } from "@/lib/actions/transport";
import { Calculator, Loader2 } from "lucide-react";

interface StudentTransportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routes: any[];
  students: any[];
  initialEnrollment?: any;
  onSuccess: () => void;
}

export function StudentTransportDialog({
  open,
  onOpenChange,
  routes,
  students,
  initialEnrollment,
  onSuccess,
}: StudentTransportDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [studentId, setStudentId] = useState(initialEnrollment?.studentId || "");
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

  // Selected Route & Stops
  const selectedRoute = useMemo(() => routes.find((r) => r.id === routeId), [routes, routeId]);
  const availableStops = useMemo(() => selectedRoute?.stops || [], [selectedRoute]);

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
    if (tripType === TransportTripType.PICKUP_ONLY || tripType === TransportTripType.DROP_ONLY) {
      multiplier = 0.6;
    }

    return Math.round(dist * ratePerKm * multiplier);
  }, [selectedRoute, distanceKm, tripType]);

  const activeMonthlyFee = customFee !== null ? Number(customFee) : calculatedFee;

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
      title={initialEnrollment ? "Edit Transport Enrollment" : "Enroll Student in Transport"}
      description="Opt student into school transport with automated distance-based monthly fee calculation."
    >
      {error && (
        <div className="p-3 mb-4 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Select Student" required>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            disabled={Boolean(initialEnrollment)}
            className={selectCls}
          >
            <option value="">-- Choose student --</option>
            {students.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.class?.name || "Class"} - Roll: {s.rollNumber})
              </option>
            ))}
          </select>
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
                  Stop {s.sequenceOrder}: {s.stopName} ({s.distanceFromSchoolKm} km)
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
              <option value={TransportTripType.TWO_WAY}>Round Trip (Two-Way 100%)</option>
              <option value={TransportTripType.PICKUP_ONLY}>Morning Pickup Only (60%)</option>
              <option value={TransportTripType.DROP_ONLY}>Afternoon Drop Only (60%)</option>
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
              : `Calculated from ${distanceKm || 0} km × ₹${selectedRoute?.defaultRatePerKm || 100}/km ${
                  tripType !== TransportTripType.TWO_WAY ? "(60% One-way)" : ""
                }`}
          </p>

          <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-900/50 flex items-center justify-between gap-2">
            <label className="text-[11px] text-slate-600 dark:text-slate-400">Manual Fee Override (₹):</label>
            <input
              type="number"
              min={0}
              placeholder={`Auto (₹${calculatedFee})`}
              value={customFee ?? ""}
              onChange={(e) => setCustomFee(e.target.value ? e.target.value : null)}
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialEnrollment ? "Save Changes" : "Confirm Enrollment"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
