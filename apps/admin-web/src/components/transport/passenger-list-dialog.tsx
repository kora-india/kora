"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@schoolos/ui";
import { getRoutePassengerManifest } from "@/lib/actions/transport";
import { Printer, Download, Bus, Loader2 } from "lucide-react";

interface PassengerListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeId: string;
}

export function PassengerListDialog({ open, onOpenChange, routeId }: PassengerListDialogProps) {
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<any>(null);

  useEffect(() => {
    if (open && routeId) {
      setLoading(true);
      getRoutePassengerManifest(routeId)
        .then((res: any) => {
          if (res?.route) setRoute(res.route);
        })
        .finally(() => setLoading(false));
    }
  }, [open, routeId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!route?.enrollments?.length) return;

    const headers = [
      "Stop Sequence",
      "Stop Name",
      "Pickup Time",
      "Drop Time",
      "Student Name",
      "Class",
      "Roll No",
      "Parent Name",
      "Parent Phone",
      "Blood Group",
      "Trip Type",
    ];

    const rows = route.enrollments.map((e: any) => [
      e.stop?.sequenceOrder || "-",
      `"${e.stop?.stopName || "-"}"`,
      e.stop?.pickupTime || "-",
      e.stop?.dropTime || "-",
      `"${e.student?.name || "-"}"`,
      `${e.student?.class?.name || "-"} ${e.student?.section?.name || ""}`,
      e.student?.rollNumber || "-",
      `"${e.student?.parentName || "-"}"`,
      e.student?.parentPhone || "-",
      e.student?.bloodGroup || "-",
      e.tripType,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Passenger_Manifest_${route.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Route Passenger Manifest & Driver Sheet"
      description="Printable roster and stop sequence manifest for drivers and roll call."
      className="max-w-4xl"
    >
      <div className="flex justify-end gap-2 pb-3 mb-3 border-b print:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={loading || !route?.enrollments?.length}
        >
          <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
        </Button>
        <Button
          size="sm"
          onClick={handlePrint}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Printer className="h-3.5 w-3.5 mr-1" /> Print Sheet
        </Button>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : route ? (
        <div className="space-y-4 print:m-0 print:p-0">
          {/* Header for Print and View */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border print:border-none print:p-0">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {route.name} {route.code ? `(${route.code})` : ""}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Route: {route.startPoint} ➔ {route.endPoint}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full">
                  {route.enrollments?.length || 0} Passengers Enrolled
                </span>
              </div>
            </div>

            {/* Vehicle & Driver Info */}
            <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Vehicle Assigned:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {route.vehicle
                    ? `${route.vehicle.type} (${route.vehicle.registrationNo})`
                    : "No vehicle"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Driver Contact:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {route.vehicle?.driverName || "N/A"} ({route.vehicle?.driverPhone || "-"})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Safety Helper / Conductor:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {route.vehicle?.helperName || "N/A"} ({route.vehicle?.helperPhone || "-"})
                </span>
              </div>
            </div>
          </div>

          {/* Passenger Roster Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Passenger Roll Call & Stop Order
            </h3>

            {route.enrollments?.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 rounded-lg">
                No students currently enrolled on this route.
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b">
                    <tr>
                      <th className="p-2.5 w-10 text-center">Seq</th>
                      <th className="p-2.5">Stop / Landmark</th>
                      <th className="p-2.5">Pickup</th>
                      <th className="p-2.5">Student Name</th>
                      <th className="p-2.5">Class</th>
                      <th className="p-2.5">Parent & Emergency Phone</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5 w-12 text-center">Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {route.enrollments.map((e: any, idx: number) => (
                      <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="p-2.5 text-center font-bold text-slate-500">
                          {e.stop?.sequenceOrder || idx + 1}
                        </td>
                        <td className="p-2.5 font-medium text-slate-900 dark:text-white">
                          {e.stop?.stopName || "-"}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400 font-mono">
                          {e.stop?.pickupTime || "-"}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-900 dark:text-white">
                          {e.student?.name}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            Roll: {e.student?.rollNumber}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">
                          {e.student?.class?.name || "-"} {e.student?.section?.name || ""}
                        </td>
                        <td className="p-2.5 text-slate-700 dark:text-slate-300">
                          {e.student?.parentName}
                          <span className="block text-[11px] font-mono text-indigo-600 font-medium">
                            {e.student?.parentPhone}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                            {e.tripType}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="w-4 h-4 mx-auto border border-slate-300 dark:border-slate-700 rounded" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
