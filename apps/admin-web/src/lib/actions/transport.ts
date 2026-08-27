"use server";

import { auth } from "@schoolos/auth";
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
import { invalidateCache } from "@/lib/redis";

const logger = createTenantLogger("global", "transport-actions");

async function getTransportSession(allowedRoles: string[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER"]) {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user;
  if (!user.schoolId) return null;
  if (!allowedRoles.includes(user.role)) return null;
  return { ...user, schoolId: user.schoolId };
}

/**
 * Auto-provisions or fetches the default "Transport Fee" FeeComponent for a school
 */
export async function getOrCreateTransportFeeComponent(schoolId: string) {
  let component = await prisma.feeComponent.findFirst({
    where: {
      schoolId,
      name: { equals: "Transport Fee", mode: "insensitive" },
    },
  });

  if (!component) {
    component = await prisma.feeComponent.create({
      data: {
        schoolId,
        name: "Transport Fee",
        description: "Standard distance-based or flat monthly transport charge",
        category: "TRANSPORT",
        amount: 0,
        frequency: "MONTHLY",
        isOptional: true,
        isActive: true,
      },
    });
  }

  return component;
}

// ─── Query Actions ─────────────────────────────────────────────────────────

export async function getTransportData() {
  const user = await getTransportSession();
  if (!user) return { error: "Unauthorized" };
  const schoolId = user.schoolId;

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
        where: sessionId ? { sessionId, status: TransportEnrollmentStatus.ACTIVE } : { status: TransportEnrollmentStatus.ACTIVE },
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
        where: sessionId ? { sessionId, status: TransportEnrollmentStatus.ACTIVE } : { status: TransportEnrollmentStatus.ACTIVE },
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
      route: { select: { id: true, name: true, code: true, defaultRatePerKm: true, flatRate: true } },
      stop: { select: { id: true, stopName: true, sequenceOrder: true, pickupTime: true, dropTime: true } },
      vehicle: { select: { id: true, registrationNo: true, type: true, driverName: true, driverPhone: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // 5. Compute KPI Fleet Metrics
  const totalVehicles = vehicles.length;
  const totalBuses = vehicles.filter((v) => v.type === VehicleType.BUS).length;
  const totalVans = vehicles.filter((v) => v.type === VehicleType.VAN).length;
  const totalRickshaws = vehicles.filter((v) => v.type === VehicleType.RICKSHAW).length;
  const totalCapacity = vehicles.reduce((sum, v) => sum + v.capacity, 0);
  const totalEnrolled = enrollments.filter((e) => e.status === TransportEnrollmentStatus.ACTIVE).length;
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
      overallOccupancyPct: totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0,
    },
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
  const user = await getTransportSession(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  if (!user) return { error: "Unauthorized" };

  const parsed = VehicleSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const existing = await prisma.vehicle.findFirst({
    where: { schoolId: user.schoolId, registrationNo: parsed.data.registrationNo },
  });
  if (existing) return { error: "A vehicle with this registration number already exists." };

  const vehicle = await prisma.vehicle.create({
    data: {
      schoolId: user.schoolId,
      ...parsed.data,
    },
  });

  revalidatePath("/transport");
  return { success: true, vehicle };
}

export async function updateVehicle(id: string, data: Partial<z.infer<typeof VehicleSchema>>) {
  const user = await getTransportSession(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  if (!user) return { error: "Unauthorized" };

  const vehicle = await prisma.vehicle.update({
    where: { id, schoolId: user.schoolId },
    data,
  });

  revalidatePath("/transport");
  return { success: true, vehicle };
}

export async function deleteVehicle(id: string) {
  const user = await getTransportSession(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  if (!user) return { error: "Unauthorized" };

  await prisma.vehicle.delete({
    where: { id, schoolId: user.schoolId },
  });

  revalidatePath("/transport");
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
  const user = await getTransportSession(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  if (!user) return { error: "Unauthorized" };

  const parsed = RouteSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { stops, ...routeData } = parsed.data;

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
  return { success: true, route };
}

export async function updateRoute(id: string, data: z.infer<typeof RouteSchema>) {
  const user = await getTransportSession(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  if (!user) return { error: "Unauthorized" };

  const parsed = RouteSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { stops, ...routeData } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.transportRoute.update({
      where: { id, schoolId: user.schoolId },
      data: routeData,
    });

    await tx.routeStop.deleteMany({ where: { routeId: id } });

    await tx.routeStop.createMany({
      data: stops.map((s, idx) => ({
        routeId: id,
        stopName: s.stopName,
        sequenceOrder: s.sequenceOrder || idx + 1,
        pickupTime: s.pickupTime,
        dropTime: s.dropTime,
        distanceFromSchoolKm: s.distanceFromSchoolKm,
      })),
    });
  });

  revalidatePath("/transport");
  return { success: true };
}

export async function deleteRoute(id: string) {
  const user = await getTransportSession(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  if (!user) return { error: "Unauthorized" };

  await prisma.transportRoute.delete({
    where: { id, schoolId: user.schoolId },
  });

  revalidatePath("/transport");
  return { success: true };
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
  status: z.nativeEnum(TransportEnrollmentStatus).default(TransportEnrollmentStatus.ACTIVE),
  notes: z.string().optional(),
});

export async function enrollStudentTransport(data: z.infer<typeof EnrollmentSchema>) {
  const user = await getTransportSession(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"]);
  if (!user) return { error: "Unauthorized" };

  const parsed = EnrollmentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const schoolId = user.schoolId;

  const currentSession = await prisma.academicSession.findFirst({
    where: { schoolId, isCurrent: true },
  });
  if (!currentSession) return { error: "No active academic session configured for this school." };

  const transportComp = await getOrCreateTransportFeeComponent(schoolId);

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

  // If monthlyFee > 0, find any active fee charge for this student and ensure Transport Fee item exists
  if (parsed.data.monthlyFee > 0) {
    const latestCharge = await prisma.feeCharge.findFirst({
      where: {
        studentId: parsed.data.studentId,
        schoolId,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
      orderBy: { dueDate: "desc" },
      include: { items: true },
    });

    if (latestCharge) {
      const existingItem = latestCharge.items.find(
        (i) => i.componentId === transportComp.id
      );
      if (existingItem) {
        if (existingItem.status !== "PAID" && existingItem.status !== "WAIVED") {
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
  await Promise.all([
    invalidateCache(`cache:${schoolId}:students:*`),
    invalidateCache(`cache:${schoolId}:feeCharges:*`),
    invalidateCache(`cache:${schoolId}:dashboard`),
    invalidateCache(`cache:${schoolId}:analytics`),
  ]);
  return { success: true, enrollment };
}

export async function cancelStudentTransport(enrollmentId: string) {
  const user = await getTransportSession(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"]);
  if (!user) return { error: "Unauthorized" };

  const enrollment = await prisma.studentTransport.update({
    where: { id: enrollmentId, schoolId: user.schoolId },
    data: {
      status: TransportEnrollmentStatus.INACTIVE,
      endDate: new Date(),
    },
  });

  revalidatePath("/transport");
  revalidatePath("/students");
  revalidatePath("/fees");
  await Promise.all([
    invalidateCache(`cache:${user.schoolId}:students:*`),
    invalidateCache(`cache:${user.schoolId}:feeCharges:*`),
    invalidateCache(`cache:${user.schoolId}:dashboard`),
    invalidateCache(`cache:${user.schoolId}:analytics`),
  ]);
  return { success: true, enrollment };
}

// ─── Driver Passenger Manifest ──────────────────────────────────────────────

export async function getRoutePassengerManifest(routeId: string) {
  const user = await getTransportSession();
  if (!user) return { error: "Unauthorized" };
  const schoolId = user.schoolId;

  const currentSession = await prisma.academicSession.findFirst({
    where: { schoolId, isCurrent: true },
  });

  const route = await prisma.transportRoute.findUnique({
    where: { id: routeId, schoolId },
    include: {
      vehicle: true,
      school: { select: { name: true, phone: true, address: true, logoUrl: true } },
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
        orderBy: [{ stop: { sequenceOrder: "asc" } }, { student: { name: "asc" } }],
      },
    },
  });

  if (!route) return { error: "Route not found" };

  return { route };
}
