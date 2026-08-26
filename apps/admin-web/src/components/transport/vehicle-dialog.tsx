"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { Button } from "@schoolos/ui";
import { VehicleType, VehicleStatus } from "@schoolos/db";
import { createVehicle, updateVehicle } from "@/lib/actions/transport";
import { Bus, Truck, Car, Loader2 } from "lucide-react";

interface VehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: any;
  onSuccess: () => void;
}

export function VehicleDialog({ open, onOpenChange, vehicle, onSuccess }: VehicleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    registrationNo: vehicle?.registrationNo || "",
    type: vehicle?.type || VehicleType.BUS,
    model: vehicle?.model || "",
    capacity: vehicle?.capacity ? String(vehicle.capacity) : "30",
    driverName: vehicle?.driverName || "",
    driverPhone: vehicle?.driverPhone || "",
    helperName: vehicle?.helperName || "",
    helperPhone: vehicle?.helperPhone || "",
    status: vehicle?.status || VehicleStatus.ACTIVE,
    notes: vehicle?.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        capacity: Number(formData.capacity),
      };

      const res = vehicle?.id
        ? await updateVehicle(vehicle.id, payload)
        : await createVehicle(payload);

      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save vehicle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={vehicle ? "Edit Fleet Vehicle" : "Add New Fleet Vehicle"}
      description="Register school buses, vans, and rickshaws with driver & safety attendant details."
    >
      {error && (
        <div className="p-3 mb-4 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Vehicle Category" required>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as VehicleType })}
              className={selectCls}
            >
              <option value={VehicleType.BUS}>🚌 Bus (Heavy / Standard)</option>
              <option value={VehicleType.VAN}>🚐 Van / Mini-Bus</option>
              <option value={VehicleType.RICKSHAW}>🛺 Rickshaw / Auto</option>
            </select>
          </FormField>

          <FormField label="Registration Number" required>
            <input
              required
              placeholder="e.g. DL-01-AB-1234"
              value={formData.registrationNo}
              onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value.toUpperCase() })}
              className={`${inputCls} uppercase`}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Vehicle Model / Make">
            <input
              placeholder="e.g. Tata Starbus 32"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className={inputCls}
            />
          </FormField>

          <FormField label="Seating Capacity" required>
            <input
              required
              type="number"
              min={1}
              placeholder="Seats"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              className={inputCls}
            />
          </FormField>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Driver & Safety Attendant
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Driver Name" required>
              <input
                required
                placeholder="Full name"
                value={formData.driverName}
                onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                className={inputCls}
              />
            </FormField>

            <FormField label="Driver Phone" required>
              <input
                required
                placeholder="+91 98765 43210"
                value={formData.driverPhone}
                onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                className={inputCls}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Helper / Conductor Name">
              <input
                placeholder="Optional"
                value={formData.helperName}
                onChange={(e) => setFormData({ ...formData, helperName: e.target.value })}
                className={inputCls}
              />
            </FormField>

            <FormField label="Helper Phone">
              <input
                placeholder="Optional"
                value={formData.helperPhone}
                onChange={(e) => setFormData({ ...formData, helperPhone: e.target.value })}
                className={inputCls}
              />
            </FormField>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Operational Status">
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as VehicleStatus })}
              className={selectCls}
            >
              <option value={VehicleStatus.ACTIVE}>Active</option>
              <option value={VehicleStatus.MAINTENANCE}>Under Maintenance</option>
              <option value={VehicleStatus.INACTIVE}>Inactive / Decommissioned</option>
            </select>
          </FormField>

          <FormField label="Notes">
            <input
              placeholder="Insurance, GPS unit ID, etc."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className={inputCls}
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {vehicle ? "Update Vehicle" : "Create Vehicle"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
