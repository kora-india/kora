"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { Button } from "@schoolos/ui";
import { RouteStatus, VehicleType } from "@schoolos/db";
import { createRoute, updateRoute } from "@/lib/actions/transport";
import { calculateDrivingDistanceKm } from "@/lib/maps";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";

interface RouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route?: any;
  vehicles: any[];
  schoolAddress?: string;
  onSuccess: () => void;
}

export function RouteDialog({
  open,
  onOpenChange,
  route,
  vehicles,
  schoolAddress = "School Main Campus",
  onSuccess,
}: RouteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [calculatingIdx, setCalculatingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: route?.name || "",
    code: route?.code || "",
    vehicleId: route?.vehicleId || "",
    startPoint: route?.startPoint || "",
    endPoint: route?.endPoint || schoolAddress || "School Campus",
    defaultRatePerKm: route?.defaultRatePerKm ? String(route.defaultRatePerKm) : "100",
    flatRate: route?.flatRate ? String(route.flatRate) : "",
    status: route?.status || RouteStatus.ACTIVE,
    stops: route?.stops?.length
      ? route.stops.map((s: any) => ({
          id: s.id,
          stopName: s.stopName,
          sequenceOrder: s.sequenceOrder,
          pickupTime: s.pickupTime || "07:30 AM",
          dropTime: s.dropTime || "03:30 PM",
          distanceFromSchoolKm: String(s.distanceFromSchoolKm || "0"),
        }))
      : [
          {
            stopName: "",
            sequenceOrder: 1,
            pickupTime: "07:15 AM",
            dropTime: "03:45 PM",
            distanceFromSchoolKm: "5.0",
          },
        ],
  });

  const handleAddStop = () => {
    const nextSeq = formData.stops.length + 1;
    setFormData({
      ...formData,
      stops: [
        ...formData.stops,
        {
          stopName: "",
          sequenceOrder: nextSeq,
          pickupTime: "07:30 AM",
          dropTime: "03:30 PM",
          distanceFromSchoolKm: "0.0",
        },
      ],
    });
  };

  const handleRemoveStop = (idx: number) => {
    if (formData.stops.length <= 1) return;
    const newStops = formData.stops.filter((_: any, i: number) => i !== idx);
    setFormData({
      ...formData,
      stops: newStops.map((s: any, i: number) => ({ ...s, sequenceOrder: i + 1 })),
    });
  };

  const handleAutoCalculateDistance = async (idx: number) => {
    const stop = formData.stops[idx];
    if (!stop.stopName) {
      alert("Please enter a stop address or landmark first.");
      return;
    }

    setCalculatingIdx(idx);
    try {
      const res = await calculateDrivingDistanceKm(formData.endPoint, stop.stopName);
      if (res.distanceKm !== null) {
        const newStops = [...formData.stops];
        newStops[idx].distanceFromSchoolKm = String(res.distanceKm);
        setFormData({ ...formData, stops: newStops });
      } else if (res.error) {
        alert(res.error);
      }
    } catch {
      alert("Failed to compute distance with Google Maps.");
    } finally {
      setCalculatingIdx(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name,
        code: formData.code || undefined,
        vehicleId: formData.vehicleId || null,
        startPoint: formData.startPoint,
        endPoint: formData.endPoint,
        defaultRatePerKm: Number(formData.defaultRatePerKm),
        flatRate: formData.flatRate ? Number(formData.flatRate) : null,
        status: formData.status as RouteStatus,
        stops: formData.stops.map((s: any, idx: number) => ({
          id: s.id,
          stopName: s.stopName,
          sequenceOrder: idx + 1,
          pickupTime: s.pickupTime,
          dropTime: s.dropTime,
          distanceFromSchoolKm: Number(s.distanceFromSchoolKm || 0),
        })),
      };

      const res = route?.id
        ? await updateRoute(route.id, payload)
        : await createRoute(payload);

      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save route");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={route ? "Edit Transport Route" : "Create Transport Route & Stops"}
      description="Plan route paths, sequenced pickup/drop stops, and per-km pricing."
      className="max-w-2xl"
    >
      {error && (
        <div className="p-3 mb-4 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Route Name" required>
            <input
              required
              placeholder="e.g. Route 1 - East City Express"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputCls}
            />
          </FormField>

          <FormField label="Route Code">
            <input
              placeholder="e.g. R-01"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className={`${inputCls} uppercase`}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Assigned Fleet Vehicle">
            <select
              value={formData.vehicleId || ""}
              onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
              className={selectCls}
            >
              <option value="">-- No vehicle assigned --</option>
              {vehicles.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.type === VehicleType.BUS && "🚌 "}
                  {v.type === VehicleType.VAN && "🚐 "}
                  {v.type === VehicleType.RICKSHAW && "🛺 "}
                  {v.registrationNo} ({v.driverName} - {v.capacity} seats)
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Route Status">
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as RouteStatus })}
              className={selectCls}
            >
              <option value={RouteStatus.ACTIVE}>Active in Service</option>
              <option value={RouteStatus.SUSPENDED}>Suspended</option>
              <option value={RouteStatus.INACTIVE}>Inactive</option>
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Origin / Starting Landmark" required>
            <input
              required
              placeholder="e.g. Sector 62 Metro Station"
              value={formData.startPoint}
              onChange={(e) => setFormData({ ...formData, startPoint: e.target.value })}
              className={inputCls}
            />
          </FormField>

          <FormField label="Destination (Campus)" required>
            <input
              required
              placeholder="e.g. School Main Gate"
              value={formData.endPoint}
              onChange={(e) => setFormData({ ...formData, endPoint: e.target.value })}
              className={inputCls}
            />
          </FormField>
        </div>

        {/* Pricing Engine */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            Fee Rate Engine
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Rate Per Kilometer (₹/km/mo)" required>
              <input
                required
                type="number"
                min={0}
                placeholder="e.g. 100"
                value={formData.defaultRatePerKm}
                onChange={(e) => setFormData({ ...formData, defaultRatePerKm: e.target.value })}
                className={inputCls}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Fee = Distance (km) × Rate/Km × Multiplier
              </p>
            </FormField>

            <FormField label="Optional Flat Monthly Rate (₹)">
              <input
                type="number"
                min={0}
                placeholder="Leave blank for per-km"
                value={formData.flatRate}
                onChange={(e) => setFormData({ ...formData, flatRate: e.target.value })}
                className={inputCls}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Fixed monthly fee regardless of distance
              </p>
            </FormField>
          </div>
        </div>

        {/* Route Stops Sequence */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Route Stops & Timings ({formData.stops.length})
            </span>
            <Button type="button" variant="outline" size="sm" onClick={handleAddStop} className="h-7 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Stop
            </Button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {formData.stops.map((stop: any, idx: number) => (
              <div key={idx} className="p-2.5 bg-white dark:bg-slate-900 border rounded-xl shadow-sm space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-[11px]">
                      {idx + 1}
                    </span>
                    <input
                      required
                      placeholder="Stop landmark / address name"
                      value={stop.stopName}
                      onChange={(e) => {
                        const newStops = [...formData.stops];
                        newStops[idx].stopName = e.target.value;
                        setFormData({ ...formData, stops: newStops });
                      }}
                      className={`${inputCls} h-8 text-xs flex-1`}
                    />
                  </div>

                  <button
                    type="button"
                    className="p-1 text-red-500 hover:text-red-700 disabled:opacity-30"
                    onClick={() => handleRemoveStop(idx)}
                    disabled={formData.stops.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 pl-7">
                  <div>
                    <label className="text-[10px] text-slate-500 block">Pickup Time</label>
                    <input
                      placeholder="07:15 AM"
                      value={stop.pickupTime}
                      onChange={(e) => {
                        const newStops = [...formData.stops];
                        newStops[idx].pickupTime = e.target.value;
                        setFormData({ ...formData, stops: newStops });
                      }}
                      className={`${inputCls} h-7 text-xs mt-0.5`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">Drop Time</label>
                    <input
                      placeholder="03:45 PM"
                      value={stop.dropTime}
                      onChange={(e) => {
                        const newStops = [...formData.stops];
                        newStops[idx].dropTime = e.target.value;
                        setFormData({ ...formData, stops: newStops });
                      }}
                      className={`${inputCls} h-7 text-xs mt-0.5`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-500">Distance (km)</label>
                      <button
                        type="button"
                        onClick={() => handleAutoCalculateDistance(idx)}
                        disabled={calculatingIdx === idx}
                        className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        {calculatingIdx === idx ? "..." : "Auto"}
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      placeholder="km"
                      value={stop.distanceFromSchoolKm}
                      onChange={(e) => {
                        const newStops = [...formData.stops];
                        newStops[idx].distanceFromSchoolKm = e.target.value;
                        setFormData({ ...formData, stops: newStops });
                      }}
                      className={`${inputCls} h-7 text-xs mt-0.5`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {route ? "Update Route" : "Save Route & Stops"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
