import { auth } from "./index";
import { UserRole } from "@schoolos/types";
import type { NextRequest } from "next/server";

export function withAuth(
  handler: (req: NextRequest, ctx: any) => Promise<Response>,
  options: { roles?: UserRole[] } = {}
) {
  return async (req: NextRequest, ctx: any) => {
    const session = await auth();

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userRole = (session.user as any).role as UserRole;

    if (options.roles && !options.roles.includes(userRole)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    return handler(req, { ...ctx, session });
  };
}

export function canAccess(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

export const ROLE_PERMISSIONS = {
  [UserRole.SUPER_ADMIN]: {
    canManageSchools: true,
    canViewAllSchools: true,
    canManageSubscriptions: true,
  },
  [UserRole.SCHOOL_ADMIN]: {
    canManageStudents: true,
    canManageTeachers: true,
    canManageFees: true,
    canManageNotices: true,
    canViewAnalytics: true,
    canManageClasses: true,
  },
  [UserRole.TEACHER]: {
    canTakeAttendance: true,
    canViewStudents: true,
    canViewFees: false,
    canEditFees: false,
    canUploadAssignments: true,
    canPublishNotices: true,
    canAddRemarks: true,
  },
  [UserRole.ACCOUNTANT]: {
    canManageFees: true,
    canViewFees: true,
    canEditFees: true,
    canViewStudents: true,
    canManagePayments: true,
  },
};
