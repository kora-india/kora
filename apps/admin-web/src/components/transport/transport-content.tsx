"use client";

import { useState } from "react";
import {
  Bus,
  Truck,
  Car,
  Route as RouteIcon,
  Users,
  DollarSign,
  Plus,
  Search,
  Printer,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  MoreVertical,
  Edit2,
  Trash2,
  SlidersHorizontal,
} from "lucide-react";
import { Button, Badge } from "@schoolos/ui";
import { inputCls } from "@/components/ui/form-field";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { VehicleDialog } from "./vehicle-dialog";
import { RouteDialog } from "./route-dialog";
import { StudentTransportDialog } from "./student-transport-dialog";
import { PassengerListDialog } from "./passenger-list-dialog";
import { VehicleType, VehicleStatus, RouteStatus, TransportEnrollmentStatus, TransportTripType } from "@schoolos/db";
import { deleteVehicle, deleteRoute, cancelStudentTransport } from "@/lib/actions/transport";
import { useRouter } from "next/navigation";

interface TransportContentProps {
  initialData: {
    currentSession: any;
    vehicles: any[];
    routes: any[];
    enrollments: any[];
    students: any[];
    metrics: any;
    userRole: string;
  };
}

export function TransportContent({ initialData }: TransportContentProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"routes" | "students" | "vehicles">("routes");
  const [searchQuery, setSearchQuery] = useState("");
  const [vehicleCategoryFilter, setVehicleCategoryFilter] = useState<string>("ALL");

  // Dialog states
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);

  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<any>(null);

  const [manifestModalOpen, setManifestModalOpen] = useState(false);
  const [manifestRouteId, setManifestRouteId] = useState<string>("");

  const { metrics, vehicles, routes, enrollments, students, userRole } = initialData;
  const isTeacher = userRole === "TEACHER";
  const canMutate = userRole === "SCHOOL_ADMIN" || userRole === "SUPER_ADMIN";
  const canEnroll = canMutate || userRole === "ACCOUNTANT";

  const refreshData = () => {
    router.refresh();
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!confirm("Are you sure you want to delete this vehicle?")) return;
    await deleteVehicle(id);
    refreshData();
  };

  const handleDeleteRoute = async (id: string) => {
    if (!confirm("Are you sure you want to delete this route? This will unassign any active stops.")) return;
    await deleteRoute(id);
    refreshData();
  };

  const handleCancelEnrollment = async (id: string) => {
    if (!confirm("Cancel transport enrollment for this student?")) return;
    await cancelStudentTransport(id);
    refreshData();
  };

  // Filtered Enrollments
  const filteredEnrollments = enrollments.filter((e: any) => {
    const q = searchQuery.toLowerCase();
    const matchName = e.student?.name?.toLowerCase().includes(q);
    const matchRoll = e.student?.rollNumber?.toLowerCase().includes(q);
    const matchRoute = e.route?.name?.toLowerCase().includes(q);
    const matchStop = e.stop?.stopName?.toLowerCase().includes(q);
    return matchName || matchRoll || matchRoute || matchStop;
  });

  // Filtered Vehicles
  const filteredVehicles = vehicles.filter((v: any) => {
    if (vehicleCategoryFilter === "ALL") return true;
    return v.type === vehicleCategoryFilter;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <Bus className="h-7 w-7 text-indigo-600" />
            Transport & Fleet Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage school buses, vans, rickshaws, routes, stops, and distance-based fee allocations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {canEnroll && (
            <Button
              onClick={() => {
                setSelectedEnrollment(null);
                setEnrollmentModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Opt-in Student
            </Button>
          )}

          {canMutate && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRoute(null);
                  setRouteModalOpen(true);
                }}
              >
                <RouteIcon className="h-4 w-4 mr-1.5 text-indigo-600" /> New Route
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setSelectedVehicle(null);
                  setVehicleModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1.5 text-emerald-600" /> Add Vehicle
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fleet Breakdown</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{metrics.totalVehicles} Vehicles</h3>
            <p className="text-[11px] text-slate-500 mt-1">
              🚌 {metrics.totalBuses} Buses · 🚐 {metrics.totalVans} Vans · 🛺 {metrics.totalRickshaws} Auto
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Bus className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Routes</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{routes.length}</h3>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">
              {routes.filter((r: any) => r.status === RouteStatus.ACTIVE).length} Active in Service
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <RouteIcon className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Capacity Occupancy</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{metrics.totalEnrolled} Students</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    metrics.overallOccupancyPct > 90 ? "bg-amber-500" : "bg-indigo-600"
                  }`}
                  style={{ width: `${Math.min(100, metrics.overallOccupancyPct)}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-700">
                {metrics.overallOccupancyPct}% ({metrics.totalCapacity} seats)
              </span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Transport Fee</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              ₹{metrics.totalMonthlyRevenue.toLocaleString("en-IN")}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Auto-billed in monthly fees</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("routes")}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "routes"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <RouteIcon className="h-4 w-4" /> Routes & Stops ({routes.length})
        </button>

        <button
          onClick={() => setActiveTab("students")}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "students"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Users className="h-4 w-4" /> Student Roster ({enrollments.length})
        </button>

        <button
          onClick={() => setActiveTab("vehicles")}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "vehicles"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Bus className="h-4 w-4" /> Vehicles & Fleet ({vehicles.length})
        </button>
      </div>

      {/* ─── TAB 1: ROUTES & STOPS ────────────────────────────────────────── */}
      {activeTab === "routes" && (
        <div className="space-y-4">
          {routes.length === 0 ? (
            <div className="text-center py-16 bg-white border rounded-2xl p-8">
              <RouteIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">No transport routes created yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Define your pickup routes, sequenced stops, per-km billing rates, and assigned fleet vehicles.
              </p>
              {canMutate && (
                <Button
                  onClick={() => {
                    setSelectedRoute(null);
                    setRouteModalOpen(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-1" /> Create First Route
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {routes.map((route: any) => {
                const passengerCount = route.enrollments?.length || 0;
                const vehicleCapacity = route.vehicle?.capacity || 0;
                const occupancyPct = vehicleCapacity > 0 ? Math.round((passengerCount / vehicleCapacity) * 100) : 0;
                const isOverCapacity = vehicleCapacity > 0 && passengerCount > vehicleCapacity;

                return (
                  <div
                    key={route.id}
                    className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col justify-between hover:border-indigo-200 transition-shadow"
                  >
                    <div className="p-4 space-y-3">
                      {/* Top Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-slate-900">{route.name}</span>
                            {route.code && (
                              <Badge variant="outline" className="text-[10px] font-mono uppercase">
                                {route.code}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {route.startPoint} ➔ {route.endPoint}
                          </p>
                        </div>

                        {canMutate && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedRoute(route);
                                  setRouteModalOpen(true);
                                }}
                              >
                                <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit Route & Stops
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteRoute(route.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Route
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {/* Vehicle & Driver Badge */}
                      <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {route.vehicle?.type === VehicleType.BUS && "🚌 Bus:"}
                            {route.vehicle?.type === VehicleType.VAN && "🚐 Van:"}
                            {route.vehicle?.type === VehicleType.RICKSHAW && "🛺 Auto:"}
                            {!route.vehicle && "❌ No Vehicle:"}
                            <span className="font-mono">{route.vehicle?.registrationNo || "Unassigned"}</span>
                          </span>
                          <Badge variant={route.status === RouteStatus.ACTIVE ? "default" : "secondary"} className="text-[10px]">
                            {route.status}
                          </Badge>
                        </div>
                        {route.vehicle && (
                          <p className="text-slate-500 text-[11px] flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {route.vehicle.driverName} ({route.vehicle.driverPhone})
                          </p>
                        )}
                      </div>

                      {/* Capacity Meter */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500">Seat Occupancy:</span>
                          <span className={`font-bold ${isOverCapacity ? "text-red-600" : "text-slate-800"}`}>
                            {passengerCount} / {vehicleCapacity || "∞"} seats ({occupancyPct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isOverCapacity ? "bg-red-500" : occupancyPct > 85 ? "bg-amber-500" : "bg-indigo-600"
                            }`}
                            style={{ width: `${Math.min(100, occupancyPct || 0)}%` }}
                          />
                        </div>
                        {isOverCapacity && (
                          <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Over capacity by {passengerCount - vehicleCapacity} students!
                          </p>
                        )}
                      </div>

                      {/* Stops Timeline Preview */}
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          Stops Sequence ({route.stops?.length || 0})
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {route.stops?.slice(0, 4).map((s: any, idx: number) => (
                            <span
                              key={s.id}
                              className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded flex items-center gap-1"
                            >
                              <span className="font-bold text-indigo-600">{idx + 1}.</span> {s.stopName}
                            </span>
                          ))}
                          {(route.stops?.length || 0) > 4 && (
                            <span className="text-[10px] text-slate-400 self-center">
                              +{route.stops.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3 bg-slate-50 border-t flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-700">
                        {route.flatRate ? `₹${route.flatRate}/mo Flat` : `₹${route.defaultRatePerKm}/km Rate`}
                      </span>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setManifestRouteId(route.id);
                          setManifestModalOpen(true);
                        }}
                        className="text-xs h-7"
                      >
                        <Printer className="h-3 w-3 mr-1" /> Passenger Sheet
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: STUDENT TRANSPORT ROSTER ──────────────────────────────── */}
      {activeTab === "students" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                placeholder="Search student, class, stop..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputCls} pl-9 text-xs h-9`}
              />
            </div>

            {canEnroll && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedEnrollment(null);
                  setEnrollmentModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Opt-in Student
              </Button>
            )}
          </div>

          {filteredEnrollments.length === 0 ? (
            <div className="text-center py-12 bg-white border rounded-xl p-8">
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No transport enrollments found</p>
              <p className="text-xs text-slate-500 mt-0.5">Students who opt into school transport will appear here.</p>
            </div>
          ) : (
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                  <tr>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Route & Assigned Stop</th>
                    <th className="p-3">Vehicle</th>
                    <th className="p-3">Trip Type</th>
                    <th className="p-3">Distance</th>
                    <th className="p-3">Monthly Fee</th>
                    <th className="p-3">Status</th>
                    {canEnroll && <th className="p-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEnrollments.map((e: any) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{e.student?.name}</span>
                        <span className="text-[11px] text-slate-400">Roll: {e.student?.rollNumber}</span>
                      </td>
                      <td className="p-3 text-slate-600">
                        {e.student?.class?.name || "-"} {e.student?.section?.name || ""}
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-900 block">{e.route?.name}</span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-indigo-500" />
                          {e.stop?.stopName || "Main Campus"}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-700">
                        {e.vehicle?.registrationNo || "Unassigned"}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {e.tripType}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-800">{e.distanceKm} km</td>
                      <td className="p-3 font-extrabold text-indigo-700">
                        ₹{Number(e.monthlyFee).toLocaleString("en-IN")}/mo
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={e.status === TransportEnrollmentStatus.ACTIVE ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {e.status}
                        </Badge>
                      </td>
                      {canEnroll && (
                        <td className="p-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedEnrollment(e);
                                  setEnrollmentModalOpen(true);
                                }}
                              >
                                <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit Allocation
                              </DropdownMenuItem>
                              {e.status === TransportEnrollmentStatus.ACTIVE && (
                                <DropdownMenuItem
                                  onClick={() => handleCancelEnrollment(e.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Cancel Transport
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: VEHICLES & FLEET ──────────────────────────────────────── */}
      {activeTab === "vehicles" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {["ALL", VehicleType.BUS, VehicleType.VAN, VehicleType.RICKSHAW].map((cat: any) => (
                <button
                  key={cat}
                  onClick={() => setVehicleCategoryFilter(cat)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    vehicleCategoryFilter === cat ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {cat === "ALL" && "All Fleet"}
                  {cat === VehicleType.BUS && "🚌 Buses"}
                  {cat === VehicleType.VAN && "🚐 Vans"}
                  {cat === VehicleType.RICKSHAW && "🛺 Auto / Rickshaws"}
                </button>
              ))}
            </div>

            {canMutate && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedVehicle(null);
                  setVehicleModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Fleet Vehicle
              </Button>
            )}
          </div>

          {filteredVehicles.length === 0 ? (
            <div className="text-center py-16 bg-white border rounded-2xl p-8">
              <Bus className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">No vehicles in this category</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Register school buses, vans, and rickshaws to allocate them to routes and drivers.
              </p>
              {canMutate && (
                <Button
                  onClick={() => {
                    setSelectedVehicle(null);
                    setVehicleModalOpen(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Vehicle
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVehicles.map((vehicle: any) => {
                const assignedPassengerCount = vehicle.enrollments?.length || 0;
                const occupancyPct = vehicle.capacity > 0 ? Math.round((assignedPassengerCount / vehicle.capacity) * 100) : 0;

                return (
                  <div key={vehicle.id} className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                          {vehicle.type === VehicleType.BUS && <Bus className="h-5 w-5" />}
                          {vehicle.type === VehicleType.VAN && <Truck className="h-5 w-5" />}
                          {vehicle.type === VehicleType.RICKSHAW && <Car className="h-5 w-5" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-slate-900 font-mono">{vehicle.registrationNo}</h4>
                          <p className="text-xs text-slate-500">{vehicle.model || vehicle.type}</p>
                        </div>
                      </div>

                      {canMutate && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedVehicle(vehicle);
                                setVehicleModalOpen(true);
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit Vehicle
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteVehicle(vehicle.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Vehicle
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Driver:</span>
                        <span className="font-semibold text-slate-800">{vehicle.driverName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Phone:</span>
                        <span className="font-mono font-medium text-indigo-600">{vehicle.driverPhone}</span>
                      </div>
                      {vehicle.helperName && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                          <span className="text-slate-500">Conductor:</span>
                          <span className="font-semibold text-slate-800">
                            {vehicle.helperName} ({vehicle.helperPhone || "-"})
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500">Capacity Utilization:</span>
                        <span className="font-bold text-slate-800">
                          {assignedPassengerCount} / {vehicle.capacity} seats ({occupancyPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-600"
                          style={{ width: `${Math.min(100, occupancyPct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between text-[11px]">
                      <Badge
                        variant={vehicle.status === VehicleStatus.ACTIVE ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {vehicle.status}
                      </Badge>
                      <span className="text-slate-500">
                        {vehicle.routes?.length || 0} Routes Assigned
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {vehicleModalOpen && (
        <VehicleDialog
          open={vehicleModalOpen}
          onOpenChange={setVehicleModalOpen}
          vehicle={selectedVehicle}
          onSuccess={refreshData}
        />
      )}

      {routeModalOpen && (
        <RouteDialog
          open={routeModalOpen}
          onOpenChange={setRouteModalOpen}
          route={selectedRoute}
          vehicles={vehicles}
          onSuccess={refreshData}
        />
      )}

      {enrollmentModalOpen && (
        <StudentTransportDialog
          open={enrollmentModalOpen}
          onOpenChange={setEnrollmentModalOpen}
          routes={routes}
          students={students}
          initialEnrollment={selectedEnrollment}
          onSuccess={refreshData}
        />
      )}

      {manifestModalOpen && (
        <PassengerListDialog
          open={manifestModalOpen}
          onOpenChange={setManifestModalOpen}
          routeId={manifestRouteId}
        />
      )}
    </div>
  );
}
