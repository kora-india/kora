"use client";

import { useState, useMemo } from "react";
import {
  Bus,
  Truck,
  Car,
  Route as RouteIcon,
  Users,
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
  Download,
  IndianRupee,
  ShieldCheck,
  Fuel,
  SlidersHorizontal,
} from "lucide-react";
import {
  Button,
  Input,
  Select,
  Tag,
  ConfigProvider,
  theme as antTheme,
  Dropdown,
  MenuProps,
} from "antd";
import { useTheme } from "next-themes";
import { useQueryTab, useQueryState } from "@/hooks/use-query-state";
import { VehicleDialog } from "./vehicle-dialog";
import { RouteDialog } from "./route-dialog";
import { StudentTransportDialog } from "./student-transport-dialog";
import { PassengerListDialog } from "./passenger-list-dialog";
import {
  VehicleType,
  VehicleStatus,
  RouteStatus,
  TransportEnrollmentStatus,
  TransportTripType,
} from "@schoolos/db";
import {
  deleteVehicle,
  deleteRoute,
  cancelStudentTransport,
} from "@/lib/actions/transport";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@schoolos/utils";

interface TransportContentProps {
  initialData: {
    currentSession: any;
    vehicles: any[];
    routes: any[];
    enrollments: any[];
    metrics: any;
    userRole: string;
  };
}

export function TransportContent({
  initialData,
}: Readonly<TransportContentProps>) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [activeTab, setActiveTab] = useQueryTab<
    "routes" | "students" | "vehicles"
  >({
    paramKey: "tab",
    validTabs: ["routes", "students", "vehicles"],
    defaultTab: "routes",
  });
  const [searchQuery, setSearchQuery] = useQueryState("q", "");
  const [routeFilter, setRouteFilter] = useQueryState("routeId", "all");
  const [vehicleCategoryFilter, setVehicleCategoryFilter] = useQueryState(
    "category",
    "ALL",
  );
  const [tripTypeFilter, setTripTypeFilter] = useQueryState("tripType", "all");
  const [statusFilter, setStatusFilter] = useQueryState("status", "all");
  const [sortBy, setSortBy] = useQueryState("sortBy", "default");

  // Pagination for Student Roster
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dialog states
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);

  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<any>(null);

  const [manifestModalOpen, setManifestModalOpen] = useState(false);
  const [manifestRouteId, setManifestRouteId] = useState<string>("");

  const { metrics, vehicles, routes, enrollments, userRole } = initialData;
  const canMutate = userRole === "SCHOOL_ADMIN" || userRole === "SUPER_ADMIN";
  const canEnroll = canMutate || userRole === "ACCOUNTANT";

  const refreshData = () => {
    router.refresh();
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!confirm("Are you sure you want to delete this vehicle?")) return;
    const toastId = `delete-veh-${id}`;
    toast.loading("Deleting vehicle...", { id: toastId });
    try {
      const res = await deleteVehicle(id);
      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success("Vehicle deleted successfully", { id: toastId });
        refreshData();
      }
    } catch {
      toast.error("Failed to delete vehicle", { id: toastId });
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this route? This will unassign any active stops.",
      )
    )
      return;
    const toastId = `delete-route-${id}`;
    toast.loading("Deleting route...", { id: toastId });
    try {
      const res = await deleteRoute(id);
      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success("Route deleted successfully", { id: toastId });
        refreshData();
      }
    } catch {
      toast.error("Failed to delete route", { id: toastId });
    }
  };

  const handleCancelEnrollment = async (id: string) => {
    if (!confirm("Cancel transport enrollment for this student?")) return;
    const toastId = `cancel-enroll-${id}`;
    toast.loading("Cancelling enrollment...", { id: toastId });
    try {
      const res = await cancelStudentTransport(id);
      if (res.error) {
        toast.error(res.error, { id: toastId });
      } else {
        toast.success("Transport allocation cancelled", { id: toastId });
        refreshData();
      }
    } catch {
      toast.error("Failed to cancel transport", { id: toastId });
    }
  };

  // Export All Transport to CSV
  const handleExportAllCSV = () => {
    if (enrollments.length === 0) {
      toast.error("No student transport records to export");
      return;
    }

    const headers = [
      "Student Name",
      "Roll No",
      "Class",
      "Route",
      "Stop",
      "Vehicle",
      "Trip Type",
      "Distance (km)",
      "Monthly Fee (INR)",
      "Status",
    ];
    const rows = enrollments.map((e: any) => [
      `"${(e.student?.name || "").replace(/"/g, '""')}"`,
      `"${e.student?.rollNumber || ""}"`,
      `"${e.student?.class?.name || ""} ${e.student?.section?.name || ""}"`,
      `"${(e.route?.name || "").replace(/"/g, '""')}"`,
      `"${(e.stop?.stopName || "").replace(/"/g, '""')}"`,
      `"${e.vehicle?.registrationNo || "Unassigned"}"`,
      e.tripType,
      e.distanceKm,
      Number(e.monthlyFee || 0).toFixed(2),
      e.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `transport_roster_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Transport roster exported to CSV");
  };

  // Filtered Routes
  const processedRoutes = useMemo(() => {
    return routes.filter((r: any) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.name?.toLowerCase().includes(q);
        const matchCode = r.code?.toLowerCase().includes(q);
        const matchStart = r.startPoint?.toLowerCase().includes(q);
        const matchEnd = r.endPoint?.toLowerCase().includes(q);
        const matchStop = r.stops?.some((s: any) =>
          s.stopName?.toLowerCase().includes(q),
        );
        if (!matchName && !matchCode && !matchStart && !matchEnd && !matchStop)
          return false;
      }
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [routes, searchQuery, statusFilter]);

  // Filtered & Sorted Enrollments
  const processedEnrollments = useMemo(() => {
    return enrollments
      .filter((e: any) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = e.student?.name?.toLowerCase().includes(q);
          const matchRoll = e.student?.rollNumber?.toLowerCase().includes(q);
          const matchRoute = e.route?.name?.toLowerCase().includes(q);
          const matchStop = e.stop?.stopName?.toLowerCase().includes(q);
          const matchVeh = e.vehicle?.registrationNo?.toLowerCase().includes(q);
          if (
            !matchName &&
            !matchRoll &&
            !matchRoute &&
            !matchStop &&
            !matchVeh
          )
            return false;
        }
        if (routeFilter !== "all" && e.routeId !== routeFilter) return false;
        if (tripTypeFilter !== "all" && e.tripType !== tripTypeFilter)
          return false;
        if (statusFilter !== "all" && e.status !== statusFilter) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        if (sortBy === "name_asc")
          return (a.student?.name || "").localeCompare(b.student?.name || "");
        if (sortBy === "name_desc")
          return (b.student?.name || "").localeCompare(a.student?.name || "");
        if (sortBy === "fee_desc")
          return Number(b.monthlyFee || 0) - Number(a.monthlyFee || 0);
        if (sortBy === "fee_asc")
          return Number(a.monthlyFee || 0) - Number(b.monthlyFee || 0);
        if (sortBy === "dist_desc")
          return Number(b.distanceKm || 0) - Number(a.distanceKm || 0);
        return 0;
      });
  }, [
    enrollments,
    searchQuery,
    routeFilter,
    tripTypeFilter,
    statusFilter,
    sortBy,
  ]);

  // Paginated Enrollments
  const paginatedEnrollments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedEnrollments.slice(start, start + pageSize);
  }, [processedEnrollments, currentPage, pageSize]);

  // Filtered Vehicles
  const processedVehicles = useMemo(() => {
    return vehicles.filter((v: any) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchReg = v.registrationNo?.toLowerCase().includes(q);
        const matchDriver = v.driverName?.toLowerCase().includes(q);
        const matchModel = v.model?.toLowerCase().includes(q);
        const matchPhone = v.driverPhone?.toLowerCase().includes(q);
        if (!matchReg && !matchDriver && !matchModel && !matchPhone)
          return false;
      }
      if (vehicleCategoryFilter !== "ALL" && v.type !== vehicleCategoryFilter)
        return false;
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      return true;
    });
  }, [vehicles, searchQuery, vehicleCategoryFilter, statusFilter]);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#7c3aed",
          borderRadius: 8,
          colorBgContainer: isDark ? "#09090b" : "#ffffff",
          colorBgElevated: isDark ? "#18181b" : "#ffffff",
          colorBorder: isDark ? "#27272a" : "#e4e4e7",
          colorBorderSecondary: isDark ? "#27272a" : "#f4f4f5",
          colorText: isDark ? "#f4f4f5" : "#09090b",
          colorTextSecondary: isDark ? "#a1a1aa" : "#71717a",
        },
      }}
    >
      <div className="flex-1 space-y-5 p-4 md:p-8 pt-6 w-full">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Transport
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track vehicle fleets, sequenced routes, stops, and student fee
              allocations
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              icon={<Download className="w-4 h-4" />}
              onClick={handleExportAllCSV}
              className="border-border text-xs font-medium"
            >
              Export CSV
            </Button>

            {canMutate && (
              <>
                <Button
                  icon={<RouteIcon className="w-4 h-4" />}
                  onClick={() => {
                    setSelectedRoute(null);
                    setRouteModalOpen(true);
                  }}
                  className="text-xs font-medium border-border"
                >
                  New Route
                </Button>

                <Button
                  icon={<Bus className="w-4 h-4" />}
                  onClick={() => {
                    setSelectedVehicle(null);
                    setVehicleModalOpen(true);
                  }}
                  className="text-xs font-medium border-border"
                >
                  Add Vehicle
                </Button>
              </>
            )}

            {canEnroll && (
              <Button
                type="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setSelectedEnrollment(null);
                  setEnrollmentModalOpen(true);
                }}
                className="bg-violet-600 hover:bg-violet-700 font-semibold text-xs shadow-sm"
              >
                Opt-in Student
              </Button>
            )}
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Total Fleet */}
          <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Fleet Breakdown
              </p>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {metrics.totalVehicles} Vehicles
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {metrics.totalBuses} Buses · {metrics.totalVans} Vans ·{" "}
                {metrics.totalRickshaws} Auto
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <Bus className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Occupancy */}
          <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Capacity Occupancy
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {metrics.totalEnrolled} Students
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {metrics.overallOccupancyPct}% of {metrics.totalCapacity} total
                seats
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Monthly Transport Revenue */}
          <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Monthly Transport Fee
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                ₹{metrics.totalMonthlyRevenue.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {routes.length} routes (
                {
                  routes.filter((r: any) => r.status === RouteStatus.ACTIVE)
                    .length
                }{" "}
                active)
              </p>
            </div>
            <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Unified Main Card Toolbar & Content */}
        <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm p-5 space-y-4">
          {/* Navigation Pill Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex flex-wrap items-center gap-2">
              {[
                {
                  key: "routes",
                  label: `Routes & Stops (${routes.length})`,
                  icon: RouteIcon,
                },
                {
                  key: "students",
                  label: `Student Roster (${enrollments.length})`,
                  icon: Users,
                },
                {
                  key: "vehicles",
                  label: `Vehicles & Fleet (${vehicles.length})`,
                  icon: Bus,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.key as any);
                      setSearchQuery("");
                      setStatusFilter("all");
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
                      isActive
                        ? "bg-violet-600 text-white border-violet-600 font-semibold shadow-xs"
                        : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-2 md:col-span-1 lg:col-span-2">
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                Search
              </label>
              <Input
                prefix={
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                }
                placeholder={
                  activeTab === "routes"
                    ? "Search route name, stop landmark, code..."
                    : activeTab === "students"
                      ? "Search student name, roll no, route, stop..."
                      : "Search registration no, driver name, model..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                allowClear
                className="w-full"
              />
            </div>

            {/* Dynamic Filter 1 */}
            {activeTab === "students" ? (
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Route
                </label>
                <Select
                  value={routeFilter}
                  onChange={setRouteFilter}
                  className="w-full"
                  options={[
                    { label: `All Routes (${routes.length})`, value: "all" },
                    ...routes.map((r: any) => ({
                      label: `${r.name} (${enrollments.filter((e: any) => e.routeId === r.id).length})`,
                      value: r.id,
                    })),
                  ]}
                />
              </div>
            ) : activeTab === "vehicles" ? (
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Category
                </label>
                <Select
                  value={vehicleCategoryFilter}
                  onChange={setVehicleCategoryFilter}
                  className="w-full"
                  options={[
                    { label: "All Fleet", value: "ALL" },
                    { label: "🚌 Buses", value: VehicleType.BUS },
                    { label: "🚐 Vans", value: VehicleType.VAN },
                    {
                      label: "🛺 Auto / Rickshaws",
                      value: VehicleType.RICKSHAW,
                    },
                  ]}
                />
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Route Status
                </label>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  className="w-full"
                  options={[
                    { label: "All Statuses", value: "all" },
                    { label: "Active", value: RouteStatus.ACTIVE },
                    { label: "Inactive", value: RouteStatus.INACTIVE },
                    { label: "Suspended", value: RouteStatus.SUSPENDED },
                  ]}
                />
              </div>
            )}

            {/* Dynamic Filter 2 / Sort */}
            {activeTab === "students" ? (
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Sort By
                </label>
                <Select
                  value={sortBy}
                  onChange={setSortBy}
                  className="w-full"
                  options={[
                    { label: "Default Order", value: "default" },
                    { label: "Student Name: A to Z", value: "name_asc" },
                    { label: "Student Name: Z to A", value: "name_desc" },
                    { label: "Monthly Fee: High to Low", value: "fee_desc" },
                    { label: "Monthly Fee: Low to High", value: "fee_asc" },
                    { label: "Distance: High to Low", value: "dist_desc" },
                  ]}
                />
              </div>
            ) : activeTab === "vehicles" ? (
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Vehicle Status
                </label>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  className="w-full"
                  options={[
                    { label: "All Statuses", value: "all" },
                    { label: "Active", value: VehicleStatus.ACTIVE },
                    { label: "Maintenance", value: VehicleStatus.MAINTENANCE },
                    { label: "Inactive", value: VehicleStatus.INACTIVE },
                  ]}
                />
              </div>
            ) : null}
          </div>

          {/* Quick Preset Filter Pills for Vehicles */}
          {activeTab === "vehicles" && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                <Bus className="w-3.5 h-3.5" /> Type:
              </span>
              {[
                { key: "ALL", label: "All Fleet" },
                { key: VehicleType.BUS, label: "🚌 Buses" },
                { key: VehicleType.VAN, label: "🚐 Vans" },
                { key: VehicleType.RICKSHAW, label: "🛺 Auto / Rickshaws" },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setVehicleCategoryFilter(p.key)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                    vehicleCategoryFilter === p.key
                      ? "bg-violet-600 text-white border-violet-600 font-semibold shadow-xs"
                      : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* ─── TAB 1: ROUTES & STOPS ────────────────────────────────────────── */}
          {activeTab === "routes" && (
            <div className="pt-2">
              {processedRoutes.length === 0 ? (
                <div className="text-center py-16 bg-muted/20 border border-border rounded-xl p-8">
                  <RouteIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-foreground">
                    No transport routes found
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                    Define pickup routes, sequenced stops, per-km billing rates,
                    and assigned fleet vehicles.
                  </p>
                  {canMutate && (
                    <Button
                      type="primary"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => {
                        setSelectedRoute(null);
                        setRouteModalOpen(true);
                      }}
                      className="bg-violet-600 hover:bg-violet-700 font-semibold text-xs shadow-sm"
                    >
                      Create First Route
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {processedRoutes.map((route: any) => {
                    const passengerCount = route.enrollments?.length || 0;
                    const vehicleCapacity = route.vehicle?.capacity || 0;
                    const occupancyPct =
                      vehicleCapacity > 0
                        ? Math.round((passengerCount / vehicleCapacity) * 100)
                        : 0;
                    const isOverCapacity =
                      vehicleCapacity > 0 && passengerCount > vehicleCapacity;

                    const menuItems: MenuProps["items"] = [
                      {
                        key: "edit",
                        label: "Edit Route & Stops",
                        icon: <Edit2 className="h-3.5 w-3.5" />,
                        onClick: () => {
                          setSelectedRoute(route);
                          setRouteModalOpen(true);
                        },
                      },
                      {
                        key: "delete",
                        danger: true,
                        label: "Delete Route",
                        icon: <Trash2 className="h-3.5 w-3.5" />,
                        onClick: () => handleDeleteRoute(route.id),
                      },
                    ];

                    return (
                      <div
                        key={route.id}
                        className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col justify-between hover:border-violet-300 dark:hover:border-violet-700 transition-all space-y-3"
                      >
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-base text-foreground">
                                  {route.name}
                                </span>
                                {route.code && (
                                  <Tag
                                    color="purple"
                                    className="font-mono text-[10px] m-0"
                                  >
                                    {route.code}
                                  </Tag>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 text-muted-foreground/70" />
                                {route.startPoint} ➔ {route.endPoint}
                              </p>
                            </div>

                            {canMutate && (
                              <Dropdown
                                menu={{ items: menuItems }}
                                placement="bottomRight"
                                trigger={["click"]}
                              >
                                <Button
                                  type="text"
                                  size="small"
                                  icon={
                                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                  }
                                />
                              </Dropdown>
                            )}
                          </div>

                          {/* Vehicle / Driver Badge */}
                          <div className="p-2.5 bg-muted/40 rounded-lg text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground flex items-center gap-1.5">
                                {route.vehicle?.type === VehicleType.BUS &&
                                  "🚌 Bus:"}
                                {route.vehicle?.type === VehicleType.VAN &&
                                  "🚐 Van:"}
                                {route.vehicle?.type === VehicleType.RICKSHAW &&
                                  "🛺 Auto:"}
                                {!route.vehicle && "❌ No Vehicle:"}
                                <span className="font-mono font-bold text-foreground">
                                  {route.vehicle?.registrationNo ||
                                    "Unassigned"}
                                </span>
                              </span>
                              <Tag
                                color={
                                  route.status === RouteStatus.ACTIVE
                                    ? "green"
                                    : "default"
                                }
                                className="text-[10px] m-0 font-semibold"
                              >
                                {route.status}
                              </Tag>
                            </div>
                            {route.vehicle && (
                              <p className="text-muted-foreground text-[11px] flex items-center gap-1">
                                <Phone className="h-3 w-3 text-muted-foreground/70" />
                                {route.vehicle.driverName} (
                                {route.vehicle.driverPhone})
                              </p>
                            )}
                          </div>

                          {/* Capacity Meter */}
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">
                                Seat Occupancy:
                              </span>
                              <span
                                className={`font-bold ${isOverCapacity ? "text-rose-600" : "text-foreground"}`}
                              >
                                {passengerCount} / {vehicleCapacity || "∞"}{" "}
                                seats ({occupancyPct}%)
                              </span>
                            </div>
                            <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isOverCapacity
                                    ? "bg-rose-500"
                                    : occupancyPct > 85
                                      ? "bg-amber-500"
                                      : "bg-violet-600"
                                }`}
                                style={{
                                  width: `${Math.min(100, occupancyPct || 0)}%`,
                                }}
                              />
                            </div>
                            {isOverCapacity && (
                              <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Over
                                capacity by {passengerCount - vehicleCapacity}{" "}
                                students!
                              </p>
                            )}
                          </div>

                          {/* Stops Preview */}
                          <div className="pt-2 border-t border-border">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                              Stops Sequence ({route.stops?.length || 0})
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {route.stops
                                ?.slice(0, 4)
                                .map((s: any, idx: number) => (
                                  <span
                                    key={s.id}
                                    className="text-[10px] bg-muted text-foreground px-2 py-0.5 rounded flex items-center gap-1"
                                  >
                                    <span className="font-bold text-violet-600">
                                      {idx + 1}.
                                    </span>{" "}
                                    {s.stopName}
                                  </span>
                                ))}
                              {(route.stops?.length || 0) > 4 && (
                                <span className="text-[10px] text-muted-foreground self-center">
                                  +{route.stops.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="pt-3 border-t border-border flex items-center justify-between">
                          <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                            {route.flatRate
                              ? `₹${route.flatRate}/mo Flat`
                              : `₹${route.defaultRatePerKm}/km Rate`}
                          </span>

                          <Button
                            size="small"
                            icon={<Printer className="h-3 w-3" />}
                            onClick={() => {
                              setManifestRouteId(route.id);
                              setManifestModalOpen(true);
                            }}
                            className="text-xs border-border"
                          >
                            Passenger Sheet
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
            <div className="pt-2 space-y-4">
              {processedEnrollments.length === 0 ? (
                <div className="text-center py-16 bg-muted/20 border border-border rounded-xl p-8">
                  <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-foreground">
                    No students allocated to transport
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                    Opt-in students for morning/afternoon bus service, select
                    stops, and calculate monthly transport fees.
                  </p>
                  {canEnroll && (
                    <Button
                      type="primary"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => {
                        setSelectedEnrollment(null);
                        setEnrollmentModalOpen(true);
                      }}
                      className="bg-violet-600 hover:bg-violet-700 font-semibold text-xs shadow-sm"
                    >
                      Opt-in Student
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                        <tr>
                          <th className="p-3">Student</th>
                          <th className="p-3">Class</th>
                          <th className="p-3">Route & Stop</th>
                          <th className="p-3">Vehicle</th>
                          <th className="p-3">Trip Type</th>
                          <th className="p-3">Distance</th>
                          <th className="p-3 text-right">Monthly Fee</th>
                          <th className="p-3">Status</th>
                          {canEnroll && (
                            <th className="p-3 text-right">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {paginatedEnrollments.map((e: any) => {
                          const menuItems: MenuProps["items"] = [
                            {
                              key: "edit",
                              label: "Edit Allocation",
                              icon: <Edit2 className="h-3.5 w-3.5" />,
                              onClick: () => {
                                setSelectedEnrollment(e);
                                setEnrollmentModalOpen(true);
                              },
                            },
                            ...(e.status === TransportEnrollmentStatus.ACTIVE
                              ? [
                                  {
                                    key: "cancel",
                                    danger: true,
                                    label: "Cancel Transport",
                                    icon: <Trash2 className="h-3.5 w-3.5" />,
                                    onClick: () => handleCancelEnrollment(e.id),
                                  },
                                ]
                              : []),
                          ];

                          return (
                            <tr
                              key={e.id}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td className="p-3">
                                <span className="font-semibold text-foreground block">
                                  {e.student?.name}
                                </span>
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  Roll: {e.student?.rollNumber || "-"}
                                </span>
                              </td>
                              <td className="p-3 text-muted-foreground">
                                {e.student?.class?.name || "-"}{" "}
                                {e.student?.section?.name || ""}
                              </td>
                              <td className="p-3">
                                <span className="font-medium text-foreground block">
                                  {e.route?.name}
                                </span>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-violet-500" />
                                  {e.stop?.stopName || "Main Campus"}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-muted-foreground font-semibold">
                                {e.vehicle?.registrationNo || "Unassigned"}
                              </td>
                              <td className="p-3">
                                <Tag
                                  color="geekblue"
                                  className="text-[11px] font-semibold m-0"
                                >
                                  {e.tripType}
                                </Tag>
                              </td>
                              <td className="p-3 font-semibold text-foreground">
                                {e.distanceKm} km
                              </td>
                              <td className="p-3 text-right font-extrabold text-violet-600 dark:text-violet-400">
                                ₹{Number(e.monthlyFee).toLocaleString("en-IN")}
                                /mo
                              </td>
                              <td className="p-3">
                                <Tag
                                  color={
                                    e.status ===
                                    TransportEnrollmentStatus.ACTIVE
                                      ? "green"
                                      : "default"
                                  }
                                  className="text-[11px] font-semibold m-0"
                                >
                                  {e.status}
                                </Tag>
                              </td>
                              {canEnroll && (
                                <td className="p-3 text-right">
                                  <Dropdown
                                    menu={{ items: menuItems }}
                                    placement="bottomRight"
                                    trigger={["click"]}
                                  >
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={
                                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                      }
                                    />
                                  </Dropdown>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-border text-xs text-muted-foreground">
                    <p>
                      Showing{" "}
                      <span className="font-semibold text-foreground">
                        {Math.min(
                          processedEnrollments.length,
                          (currentPage - 1) * pageSize + 1,
                        )}
                      </span>{" "}
                      to{" "}
                      <span className="font-semibold text-foreground">
                        {Math.min(
                          processedEnrollments.length,
                          currentPage * pageSize,
                        )}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-foreground">
                        {processedEnrollments.length}
                      </span>{" "}
                      students
                    </p>

                    <div className="flex items-center gap-2">
                      <span>Rows:</span>
                      <Select
                        size="small"
                        value={pageSize}
                        onChange={(v) => {
                          setPageSize(v);
                          setCurrentPage(1);
                        }}
                        options={[
                          { label: "10", value: 10 },
                          { label: "25", value: 25 },
                          { label: "50", value: 50 },
                        ]}
                      />
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          size="small"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage((p) => p - 1)}
                        >
                          &lt;
                        </Button>
                        <span className="px-2 py-1 rounded bg-violet-600 text-white font-bold text-xs">
                          {currentPage}
                        </span>
                        <Button
                          size="small"
                          disabled={
                            currentPage * pageSize >=
                            processedEnrollments.length
                          }
                          onClick={() => setCurrentPage((p) => p + 1)}
                        >
                          &gt;
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── TAB 3: VEHICLES & FLEET ──────────────────────────────────────── */}
          {activeTab === "vehicles" && (
            <div className="pt-2 space-y-4">
              {processedVehicles.length === 0 ? (
                <div className="text-center py-16 bg-muted/20 border border-border rounded-xl p-8">
                  <Bus className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-foreground">
                    No fleet vehicles in this category
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                    Register school buses, vans, and rickshaws to allocate them
                    to routes and drivers.
                  </p>
                  {canMutate && (
                    <Button
                      type="primary"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => {
                        setSelectedVehicle(null);
                        setVehicleModalOpen(true);
                      }}
                      className="bg-violet-600 hover:bg-violet-700 font-semibold text-xs shadow-sm"
                    >
                      Add Vehicle
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {processedVehicles.map((vehicle: any) => {
                    const assignedPassengerCount =
                      vehicle.enrollments?.length || 0;
                    const occupancyPct =
                      vehicle.capacity > 0
                        ? Math.round(
                            (assignedPassengerCount / vehicle.capacity) * 100,
                          )
                        : 0;

                    const menuItems: MenuProps["items"] = [
                      {
                        key: "edit",
                        label: "Edit Vehicle",
                        icon: <Edit2 className="h-3.5 w-3.5" />,
                        onClick: () => {
                          setSelectedVehicle(vehicle);
                          setVehicleModalOpen(true);
                        },
                      },
                      {
                        key: "delete",
                        danger: true,
                        label: "Delete Vehicle",
                        icon: <Trash2 className="h-3.5 w-3.5" />,
                        onClick: () => handleDeleteVehicle(vehicle.id),
                      },
                    ];

                    return (
                      <div
                        key={vehicle.id}
                        className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-3 hover:border-violet-300 dark:hover:border-violet-700 transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
                                {vehicle.type === VehicleType.BUS && (
                                  <Bus className="h-5 w-5" />
                                )}
                                {vehicle.type === VehicleType.VAN && (
                                  <Truck className="h-5 w-5" />
                                )}
                                {vehicle.type === VehicleType.RICKSHAW && (
                                  <Car className="h-5 w-5" />
                                )}
                              </div>
                              <div>
                                <span className="font-bold text-sm text-foreground block font-mono">
                                  {vehicle.registrationNo}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {vehicle.model || `${vehicle.type}`} ·{" "}
                                  {vehicle.capacity} Seats
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Tag
                                color={
                                  vehicle.status === VehicleStatus.ACTIVE
                                    ? "green"
                                    : vehicle.status ===
                                        VehicleStatus.MAINTENANCE
                                      ? "gold"
                                      : "default"
                                }
                                className="text-[10px] m-0 font-semibold"
                              >
                                {vehicle.status}
                              </Tag>
                              {canMutate && (
                                <Dropdown
                                  menu={{ items: menuItems }}
                                  placement="bottomRight"
                                  trigger={["click"]}
                                >
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={
                                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                    }
                                  />
                                </Dropdown>
                              )}
                            </div>
                          </div>

                          {/* Crew / Contacts */}
                          <div className="p-2.5 bg-muted/40 rounded-lg text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                Driver:
                              </span>
                              <span className="font-semibold text-foreground flex items-center gap-1">
                                {vehicle.driverName} ({vehicle.driverPhone})
                              </span>
                            </div>
                            {vehicle.helperName && (
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>Attendant:</span>
                                <span>
                                  {vehicle.helperName}{" "}
                                  {vehicle.helperPhone
                                    ? `(${vehicle.helperPhone})`
                                    : ""}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Seat Capacity Progress */}
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">
                                Assigned Seats:
                              </span>
                              <span className="font-bold text-foreground">
                                {assignedPassengerCount} / {vehicle.capacity}{" "}
                                seats ({occupancyPct}%)
                              </span>
                            </div>
                            <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  occupancyPct > 100
                                    ? "bg-rose-500"
                                    : occupancyPct > 85
                                      ? "bg-amber-500"
                                      : "bg-violet-600"
                                }`}
                                style={{
                                  width: `${Math.min(100, occupancyPct)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Footer Notes */}
                        <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />{" "}
                            Insured & Verified
                          </span>
                          {vehicle.notes && (
                            <span className="truncate max-w-[150px]">
                              {vehicle.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dialog Modals */}
      <VehicleDialog
        open={vehicleModalOpen}
        onOpenChange={setVehicleModalOpen}
        vehicle={selectedVehicle}
        onSuccess={refreshData}
      />

      <RouteDialog
        open={routeModalOpen}
        onOpenChange={setRouteModalOpen}
        route={selectedRoute}
        vehicles={vehicles}
        onSuccess={refreshData}
      />

      <StudentTransportDialog
        open={enrollmentModalOpen}
        onOpenChange={setEnrollmentModalOpen}
        initialEnrollment={selectedEnrollment}
        routes={routes}
        onSuccess={refreshData}
      />

      <PassengerListDialog
        open={manifestModalOpen}
        onOpenChange={setManifestModalOpen}
        routeId={manifestRouteId}
      />
    </ConfigProvider>
  );
}
