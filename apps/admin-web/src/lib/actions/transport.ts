"use server";

import { requirePermission } from "@/lib/auth-guard";
import { hasFeatureAccess } from "@/lib/subscription";
import {
  prisma,
  VehicleType,
  VehicleStatus,
  RouteStatus,
  TransportEnrollmentStatus,
  TransportTripType,
} from "@schoolos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createTenantLogger } from "@schoolos/logger";
import { getCache, invalidateTransportCache } from "@/lib/redis";
import { findOrCreateTransportComponent } from "@/lib/fees/transport-component";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { logActivity, money } from "@/lib/activity";

const logger = createTenantLogger("global", "transport-actions");

async function getTransportSession(level: "view" | "manage" = "view") {
  const guard = await requirePermission("transport", level);
  if ("error" in guard) return null;

  if (guard.role !== "SUPER_ADMIN") {
    const school = await prisma.school.findUnique({
      where: { id: guard.schoolId! },
      select: {
        plan: true,
        subscription: { select: { plan: true, status: true } },
      },
    });

    if (
      !hasFeatureAccess(
        school?.plan || "FREE",
        school?.subscription?.status || "ACTIVE",
        "TRANSPORT",
        await getPlanCatalog(),
      )
    ) {
      return null;
    }
  }

  return { ...guard, schoolId: guard.schoolId! };
}

// ─── Query Actions ─────────────────────────────────────────────────────────

export async function getTransportData() {
  const user = await getTransportSession();
  if (!user) return { error: "Unauthorized" };
  const schoolId = user.schoolId;

  const data = await getCache(
    `cache:${schoolId}:transport:data`,
    async () => {
      // 1. Get active session
      const currentSession = await prisma.academicSession.findFirst({
        where: { schoolId, isCurrent: true },
      });

      const sessionId = currentSession?.id;

      // 2. Fetch Vehicles with occupancy count
      const vehicles = await prisma.vehicle.findMany({
        where: { schoolId },
        include: {
          routes: { select: { id: true, name: true, code: true } },
          enrollments: {
            where: sessionId
              ? { sessionId, status: TransportEnrollmentStatus.ACTIVE }
              : { status: TransportEnrollmentStatus.ACTIVE },
            select: { id: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // 3. Fetch Routes with ordered stops and passenger count
      const routes = await prisma.transportRoute.findMany({
        where: { schoolId },
        include: {
          vehicle: true,
          stops: { orderBy: { sequenceOrder: "asc" } },
          enrollments: {
            where: sessionId
              ? { sessionId, status: TransportEnrollmentStatus.ACTIVE }
              : { status: TransportEnrollmentStatus.ACTIVE },
            select: { id: true, monthlyFee: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // 4. Fetch Student Transport Enrollments
      const enrollments = await prisma.studentTransport.findMany({
        where: {
          schoolId,
          ...(sessionId ? { sessionId } : {}),
        },
        include: {
          student: {
            include: {
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
          route: {
            select: {
              id: true,
              name: true,
              code: true,
              defaultRatePerKm: true,
              flatRate: true,
            },
          },
          stop: {
            select: {
              id: true,
              stopName: true,
              sequenceOrder: true,
              pickupTime: true,
              dropTime: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              registrationNo: true,
              type: true,
              driverName: true,
              driverPhone: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // 5. Compute KPI Fleet Metrics
      const totalVehicles = vehicles.length;
      const totalBuses = vehicles.filter(
        (v) => v.type === VehicleType.BUS,
      ).length;
      const totalVans = vehicles.filter(
        (v) => v.type === VehicleType.VAN,
      ).length;
      const totalRickshaws = vehicles.filter(
        (v) => v.type === VehicleType.RICKSHAW,
      ).length;
      const totalCapacity = vehicles.reduce((sum, v) => sum + v.capacity, 0);
      const totalEnrolled = enrollments.filter(
        (e) => e.status === TransportEnrollmentStatus.ACTIVE,
      ).length;
      const totalMonthlyRevenue = enrollments
        .filter((e) => e.status === TransportEnrollmentStatus.ACTIVE)
        .reduce((sum, e) => sum + Number(e.monthlyFee), 0);

      return {
        currentSession,
        vehicles,
        routes,
        enrollments,
        metrics: {
          totalVehicles,
          totalBuses,
          totalVans,
          totalRickshaws,
          totalCapacity,
          totalEnrolled,
          totalMonthlyRevenue,
          overallOccupancyPct:
            totalCapacity > 0
              ? Math.round((totalEnrolled / totalCapacity) * 100)
              : 0,
        },
      };
    },
    300,
  );

  return {
    ...data,
    userRole: user.role,
  };
}

// ─── Vehicle Fleet Actions ──────────────────────────────────────────────────

const VehicleSchema = z.object({
  registrationNo: z.string().min(3),
  type: z.nativeEnum(VehicleType).default(VehicleType.BUS),
  model: z.string().optional(),
  capacity: z.coerce.number().min(1),
  driverName: z.string().min(2),
  driverPhone: z.string().min(10),
  helperName: z.string().optional(),
  helperPhone: z.string().optional(),
  status: z.nativeEnum(VehicleStatus).default(VehicleStatus.ACTIVE),
  notes: z.string().optional(),
});

export async function createVehicle(data: z.infer<typeof VehicleSchema>) {
  const user = await getTransportSession("manage");
  if (!user) return { error: "Unauthorized" };

  const parsed = VehicleSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const existing = await prisma.vehicle.findFirst({
    where: {
      schoolId: user.schoolId,
      registrationNo: parsed.data.registrationNo,
    },
  });
  if (existing)
    return { error: "A vehicle with this registration number already exists." };

  const vehicle = await prisma.vehicle.create({
    data: {
      schoolId: user.schoolId,
      ...parsed.data,
    },
  });

  revalidatePath("/transport");
  await invalidateTransportCache(user.schoolId);
  await logActivity(user, {
    action: "vehicle.create",
    module: "transport",
    summary: `Added vehicle ${vehicle.registrationNo}`,
    entityType: "Vehicle",
    entityId: vehicle.id,
  });
  return { success: true, vehicle };
}

export async function updateVehicle(id: string, data: unknown) {
  const user = await getTransportSession("manage");
  if (!user) return { error: "Unauthorized" };

  const parsed = VehicleSchema.partial().safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const existing = await prisma.vehicle.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!existing) return { error: "Vehicle not found in your school" };

  const vehicle = await prisma.vehicle.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  revalidatePath("/transport");
  await invalidateTransportCache(user.schoolId);
  await logActivity(user, {
    action: "vehicle.update",
    module: "transport",
    summary: `Edited vehicle ${vehicle.registrationNo}`,
    entityType: "Vehicle",
    entityId: vehicle.id,
  });
  return { success: true, vehicle };
}

export async function deleteVehicle(id: string) {
  const user = await getTransportSession("manage");
  if (!user) return { error: "Unauthorized" };

  const existing = await prisma.vehicle.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!existing) return { error: "Vehicle not found in your school" };

  await prisma.vehicle.delete({
    where: { id: existing.id },
  });

  revalidatePath("/transport");
  await invalidateTransportCache(user.schoolId);
  await logActivity(user, {
    action: "vehicle.delete",
    module: "transport",
    summary: `Deleted vehicle ${existing.registrationNo}`,
    entityType: "Vehicle",
    entityId: existing.id,
  });
  return { success: true };
}

// ─── Route & Stop Actions ───────────────────────────────────────────────────

const RouteStopSchema = z.object({
  id: z.string().optional(),
  stopName: z.string().min(2),
  sequenceOrder: z.coerce.number().min(1),
  pickupTime: z.string().optional(),
  dropTime: z.string().optional(),
  distanceFromSchoolKm: z.coerce.number().min(0).default(0),
});

const RouteSchema = z.object({
  name: z.string().min(3),
  code: z.string().optional(),
  vehicleId: z.string().optional().nullable(),
  startPoint: z.string().min(2),
  endPoint: z.string().min(2),
  defaultRatePerKm: z.coerce.number().min(0).default(100),
  flatRate: z.coerce.number().optional().nullable(),
  status: z.nativeEnum(RouteStatus).default(RouteStatus.ACTIVE),
  stops: z.array(RouteStopSchema).min(1, "At least 1 stop is required"),
});

export async function createRoute(data: z.infer<typeof RouteSchema>) {
  const user = await getTransportSession("manage");
  if (!user) return { error: "Unauthorized" };

  const parsed = RouteSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { stops, ...routeData } = parsed.data;

  if (routeData.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: routeData.vehicleId, schoolId: user.schoolId },
    });
    if (!vehicle) return { error: "Vehicle not found in your school" };
  }

  const existing = await prisma.transportRoute.findFirst({
    where: { schoolId: user.schoolId, name: routeData.name },
  });
  if (existing) return { error: "A route with this name already exists." };

  const route = await prisma.transportRoute.create({
    data: {
      schoolId: user.schoolId,
      ...routeData,
      stops: {
        create: stops.map((s, idx) => ({
          stopName: s.stopName,
          sequenceOrder: s.sequenceOrder || idx + 1,
          pickupTime: s.pickupTime,
          dropTime: s.dropTime,
          distanceFromSchoolKm: s.distanceFromSchoolKm,
        })),
      },
    },
    include: { stops: true },
  });

  revalidatePath("/transport");
  await invalidateTransportCache(user.schoolId);
  await logActivity(user, {
    action: "route.create",
    module: "transport",
    summary: `Added route ${route.name} with ${route.stops.length} stop${route.stops.length === 1 ? "" : "s"}`,
    entityType: "TransportRoute",
    entityId: route.id,
  });
  return { success: true, route };
}

export async function updateRoute(
  id: string,
  data: z.infer<typeof RouteSchema>,
) {
  const user = await getTransportSession("manage");
  if (!user) return { error: "Unauthorized" };

  const parsed = RouteSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const existingRoute = await prisma.transportRoute.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!existingRoute) return { error: "Route not found in your school" };

  const { stops, ...routeData } = parsed.data;

  if (routeData.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: routeData.vehicleId, schoolId: user.schoolId },
    });
    if (!vehicle) return { error: "Vehicle not found in your school" };
  }

  // D1: update stops in place. Deleting and recreating them used to cascade
  // into every student enrollment on the route.
  const existingStops = await prisma.routeStop.findMany({
    where: { routeId: existingRoute.id },
    select: {
      id: true,
      stopName: true,
      _count: { select: { enrollments: true } },
    },
  });
  const existingStopIds = new Set(existingStops.map((s) => s.id));
  const keptStopIds = new Set(
    stops.map((s) => s.id).filter((sid): sid is string => !!sid),
  );
  if ([...keptStopIds].some((sid) => !existingStopIds.has(sid))) {
    return { error: "One or more stops don't belong to this route" };
  }
  const removedStops = existingStops.filter((s) => !keptStopIds.has(s.id));
  const stopsInUse = removedStops.filter((s) => s._count.enrollments > 0);
  if (stopsInUse.length > 0) {
    return {
      error: `Can't remove ${stopsInUse
        .map((s) => `"${s.stopName}" (${s._count.enrollments} students)`)
        .join(", ")}. Move those students to another stop first.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.transportRoute.update({
      where: { id: existingRoute.id },
      data: routeData,
    });

    if (removedStops.length > 0) {
      await tx.routeStop.deleteMany({
        where: { id: { in: removedStops.map((s) => s.id) } },
      });
    }

    for (const [idx, s] of stops.entries()) {
      const stopData = {
        stopName: s.stopName,
        sequenceOrder: s.sequenceOrder || idx + 1,
        pickupTime: s.pickupTime,
        dropTime: s.dropTime,
        distanceFromSchoolKm: s.distanceFromSchoolKm,
      };
      if (s.id) {
        await tx.routeStop.update({ where: { id: s.id }, data: stopData });
      } else {
        await tx.routeStop.create({
          data: { ...stopData, routeId: existingRoute.id },
        });
      }
    }
  });

  revalidatePath("/transport");
  await invalidateTransportCache(user.schoolId);
  await logActivity(user, {
    action: "route.update",
    module: "transport",
    summary: `Edited route ${routeData.name}`,
    entityType: "TransportRoute",
    entityId: existingRoute.id,
  });
  return { success: true };
}

/**
 * Deletes a route with no enrollment history. A route that students have used
 * is deactivated instead, so their past enrollments are kept (D1). A route
 * with active enrollments can't be removed until they are moved or cancelled.
 */
export async function deleteRoute(id: string) {
  const user = await getTransportSession("manage");
  if (!user) return { error: "Unauthorized" };

  const existing = await prisma.transportRoute.findFirst({
    where: { id, schoolId: user.schoolId },
  });
  if (!existing) return { error: "Route not found in your school" };

  const [activeEnrollments, pastEnrollments] = await Promise.all([
    prisma.studentTransport.count({
      where: { routeId: existing.id, status: TransportEnrollmentStatus.ACTIVE },
    }),
    prisma.studentTransport.count({
      where: {
        routeId: existing.id,
        status: { not: TransportEnrollmentStatus.ACTIVE },
      },
    }),
  ]);

  if (activeEnrollments > 0) {
    return {
      error: `${activeEnrollments} students are enrolled on this route. Move them to another route or cancel their transport first.`,
    };
  }

  let archived = false;
  if (pastEnrollments > 0) {
    await prisma.transportRoute.update({
      where: { id: existing.id },
      data: { status: RouteStatus.INACTIVE },
    });
    archived = true;
  } else {
    // Its stops are deleted with it; no enrollment references them.
    await prisma.transportRoute.delete({ where: { id: existing.id } });
  }

  revalidatePath("/transport");
  await invalidateTransportCache(user.schoolId);
  await logActivity(user, {
    action: "route.delete",
    module: "transport",
    summary: archived
      ? `Turned off route ${existing.name} (kept for its history)`
      : `Deleted route ${existing.name}`,
    entityType: "TransportRoute",
    entityId: existing.id,
  });
  return { success: true, archived };
}

// ─── Student Transport Enrollment Actions ───────────────────────────────────

const EnrollmentSchema = z.object({
  studentId: z.string(),
  routeId: z.string(),
  stopId: z.string(),
  vehicleId: z.string().optional().nullable(),
  tripType: z.nativeEnum(TransportTripType).default(TransportTripType.TWO_WAY),
  distanceKm: z.coerce.number().min(0),
  monthlyFee: z.coerce.number().min(0),
  status: z
    .nativeEnum(TransportEnrollmentStatus)
    .default(TransportEnrollmentStatus.ACTIVE),
  notes: z.string().optional(),
});

export async function enrollStudentTransport(
  data: z.infer<typeof EnrollmentSchema>,
) {
  const user = await getTransportSession("manage");
  if (!user) return { error: "Unauthorized" };

  const parsed = EnrollmentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const schoolId = user.schoolId;

  const student = await prisma.student.findFirst({
    where: { id: parsed.data.studentId, schoolId },
  });
  if (!student) return { error: "Student not found in your school" };

  const route = await prisma.transportRoute.findFirst({
    where: { id: parsed.data.routeId, schoolId },
  });
  if (!route) return { error: "Route not found in your school" };

  const stop = await prisma.routeStop.findFirst({
    where: { id: parsed.data.stopId, routeId: parsed.data.routeId },
  });
  if (!stop) return { error: "Stop not found for this route" };

  if (parsed.data.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: parsed.data.vehicleId, schoolId },
    });
    if (!vehicle) return { error: "Vehicle not found in your school" };
  }

  const currentSession = await prisma.academicSession.findFirst({
    where: { schoolId, isCurrent: true },
  });
  if (!currentSession)
    return { error: "No active academic session configured for this school." };

  const transportComp = await findOrCreateTransportComponent(schoolId);

  const enrollment = await prisma.studentTransport.upsert({
    where: {
      studentId_sessionId: {
        studentId: parsed.data.studentId,
        sessionId: currentSession.id,
      },
    },
    update: {
      ...parsed.data,
      schoolId,
      status: TransportEnrollmentStatus.ACTIVE,
    },
    create: {
      ...parsed.data,
      schoolId,
      sessionId: currentSession.id,
    },
    include: {
      student: true,
      route: true,
      stop: true,
    },
  });

  // The bus starts now, so only the student's newest bill gets its fee, and
  // only while that bill is open. An older unpaid month must not; once the
  // newest bill is paid, the next month's bill includes the bus.
  if (parsed.data.monthlyFee > 0) {
    const latestCharge = await prisma.feeCharge.findFirst({
      where: {
        studentId: parsed.data.studentId,
        schoolId,
        sessionId: currentSession.id,
      },
      orderBy: { dueDate: "desc" },
      include: { items: true },
    });

    if (
      latestCharge &&
      ["PENDING", "PARTIAL", "OVERDUE"].includes(latestCharge.status)
    ) {
      const existingItem = latestCharge.items.find(
        (i) => i.componentId === transportComp.id,
      );
      if (existingItem) {
        if (
          existingItem.status !== "PAID" &&
          existingItem.status !== "WAIVED"
        ) {
          await prisma.feeChargeItem.update({
            where: { id: existingItem.id },
            data: { amount: parsed.data.monthlyFee },
          });
        }
      } else {
        await prisma.feeChargeItem.create({
          data: {
            chargeId: latestCharge.id,
            componentId: transportComp.id,
            amount: parsed.data.monthlyFee,
            paidAmount: 0,
            status: "PENDING",
          },
        });
      }
    }
  }

  revalidatePath("/transport");
  revalidatePath("/students");
  revalidatePath("/fees");
  await invalidateTransportCache(schoolId);
  await logActivity(user, {
    action: "transport.enroll",
    module: "transport",
    summary: `Put ${student.name} on route ${route.name} (stop ${stop.stopName}, ${money(parsed.data.monthlyFee)}/month)`,
    entityType: "StudentTransport",
    entityId: enrollment.id,
  });
  return { success: true, enrollment };
}

export async function cancelStudentTransport(enrollmentId: string) {
  const user = await getTransportSession("manage");
  if (!user) return { error: "Unauthorized" };

  const existing = await prisma.studentTransport.findFirst({
    where: { id: enrollmentId, schoolId: user.schoolId },
    include: {
      student: { select: { name: true } },
      route: { select: { name: true } },
    },
  });
  if (!existing) return { error: "Enrollment not found in your school" };

  const enrollment = await prisma.studentTransport.update({
    where: { id: existing.id },
    data: {
      status: TransportEnrollmentStatus.INACTIVE,
      endDate: new Date(),
    },
  });

  revalidatePath("/transport");
  revalidatePath("/students");
  revalidatePath("/fees");
  await invalidateTransportCache(user.schoolId);
  await logActivity(user, {
    action: "transport.cancel",
    module: "transport",
    summary: `Took ${existing.student.name} off route ${existing.route.name}`,
    entityType: "StudentTransport",
    entityId: existing.id,
  });
  return { success: true, enrollment };
}

// ─── Driver Passenger Manifest ──────────────────────────────────────────────

export async function getRoutePassengerManifest(routeId: string) {
  const user = await getTransportSession();
  if (!user) return { error: "Unauthorized" };
  const schoolId = user.schoolId;

  return getCache(
    `cache:${schoolId}:transport:manifest:${routeId}`,
    async () => {
      const currentSession = await prisma.academicSession.findFirst({
        where: { schoolId, isCurrent: true },
      });

      const route = await prisma.transportRoute.findUnique({
        where: { id: routeId, schoolId },
        include: {
          vehicle: true,
          school: {
            select: { name: true, phone: true, address: true, logoUrl: true },
          },
          stops: { orderBy: { sequenceOrder: "asc" } },
          enrollments: {
            where: {
              status: TransportEnrollmentStatus.ACTIVE,
              ...(currentSession ? { sessionId: currentSession.id } : {}),
            },
            include: {
              student: {
                include: {
                  class: { select: { name: true } },
                  section: { select: { name: true } },
                },
              },
              stop: true,
            },
            orderBy: [
              { stop: { sequenceOrder: "asc" } },
              { student: { name: "asc" } },
            ],
          },
        },
      });

      if (!route) return { error: "Route not found" };

      return { route };
    },
    300,
  );
}
