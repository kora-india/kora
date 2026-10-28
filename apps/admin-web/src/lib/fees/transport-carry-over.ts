import type { Prisma } from "@schoolos/db";

/**
 * Bus riders are enrolled per session. When a new school year becomes
 * current, the riders of the year before keep their seat (and their monthly
 * bus fee) unless someone cancels it. Students who left are not carried, nor
 * anyone already enrolled in the new year. Moving the current session back to
 * an earlier year carries nothing.
 *
 * Returns how many enrollments were carried.
 */
export async function carryTransportForward(
  tx: Prisma.TransactionClient,
  schoolId: string,
  previous: { id: string; startDate: Date } | null,
  next: { id: string; startDate: Date },
): Promise<number> {
  if (!previous || previous.id === next.id) return 0;
  if (next.startDate <= previous.startDate) return 0;

  const riders = await tx.studentTransport.findMany({
    where: {
      schoolId,
      sessionId: previous.id,
      status: "ACTIVE",
      student: { isActive: true },
    },
  });
  if (riders.length === 0) return 0;

  const result = await tx.studentTransport.createMany({
    data: riders.map((r) => ({
      schoolId,
      studentId: r.studentId,
      sessionId: next.id,
      routeId: r.routeId,
      stopId: r.stopId,
      vehicleId: r.vehicleId,
      tripType: r.tripType,
      distanceKm: r.distanceKm,
      monthlyFee: r.monthlyFee,
      startDate: next.startDate,
      notes: r.notes,
    })),
    // Already enrolled in the new year (unique per student and session).
    skipDuplicates: true,
  });
  return result.count;
}
