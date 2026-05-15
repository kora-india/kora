import { auth } from "@schoolos/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/suspended", "/api/health", "/api/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Always allow public paths
  if (isPublic(pathname)) {
    // Redirect authenticated users away from login
    if (req.auth && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Require auth for everything else
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // SUPER_ADMIN has no schoolId — block them from school-specific pages
  const user = req.auth.user as any;
  if (user?.role === "SUPER_ADMIN" && pathname.startsWith("/schools") === false) {
    // Allow super admin everywhere in the dashboard
  }

  const res = NextResponse.next();
  // Security headers
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
});

export const config = {
  // Exclude Next.js internals and common static assets; otherwise CSS/JS can get redirected.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)"],
};
