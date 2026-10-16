import { prisma, type FeeComponent } from "@schoolos/db";

/**
 * Finds the school's transport fee component, creating it if missing.
 *
 * Schools created before the seed was fixed store the category as
 * "Transport", newer ones as "TRANSPORT", and some only have a component
 * named "Transport Fee", so match all of them case-insensitively. Call this
 * outside an interactive transaction: a unique-name race is handled by
 * re-reading, which an aborted Postgres transaction can't do.
 */
export async function findOrCreateTransportComponent(
  schoolId: string,
): Promise<FeeComponent> {
  const find = () =>
    prisma.feeComponent.findFirst({
      where: {
        schoolId,
        OR: [
          { category: { equals: "TRANSPORT", mode: "insensitive" } },
          { name: { equals: "Transport Fee", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

  const existing = await find();
  if (existing) return existing;

  try {
    return await prisma.feeComponent.create({
      data: {
        schoolId,
        name: "Transport Fee",
        description: "Distance-based monthly transport charge",
        category: "TRANSPORT",
        amount: 0,
        frequency: "MONTHLY",
        isOptional: true,
        isActive: true,
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      const raced = await find();
      if (raced) return raced;
    }
    throw e;
  }
}
