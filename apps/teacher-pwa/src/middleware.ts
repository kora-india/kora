import { auth } from "@schoolos/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/login"))
    return NextResponse.next();
  if (!req.auth?.user) return NextResponse.redirect(new URL("/login", req.url));

  const role = req.auth.user.role;
  if (role !== "TEACHER" && role !== "SUPER_ADMIN") {
    return NextResponse.redirect(
      new URL("/login?error=ForbiddenRole", req.url),
    );
  }

  // A temporary password is replaced before anything else.
  if (req.auth.user.mustChangePassword && role !== "SUPER_ADMIN") {
    if (pathname === "/change-password" || pathname === "/api/account/password")
      return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Change your temporary password first" },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  return NextResponse.next();
});

export const config = {
  // sw.js and manifest.json must load before sign-in (U8).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.png$).*)",
  ],
  // Next.js 15.2+ supports Node.js middleware runtime (experimental).
  runtime: "nodejs",
};
