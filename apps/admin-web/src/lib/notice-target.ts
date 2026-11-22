import { prisma } from "@schoolos/db";

export const NOTICE_CLASS_NOT_FOUND = "That class isn't in your school";

/**
 * Whether a notice can be aimed at this class: no class (the whole school)
 * or one of the school's own. `targetClassId` has no foreign key, so without
 * this a notice could name another school's class.
 */
export async function isNoticeTargetAllowed(
  schoolId: string,
  targetClassId: string | null | undefined,
) {
  if (!targetClassId) return true;
  const found = await prisma.class.findFirst({
    where: { id: targetClassId, schoolId },
    select: { id: true },
  });
  return Boolean(found);
}
