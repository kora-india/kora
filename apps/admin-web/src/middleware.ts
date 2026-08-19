import { auth } from "@schoolos/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/suspended", "/api/health", "/api/auth", "/api/cron"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Redirect Vercel deployment-specific URLs to the canonical domain.
  // Session cookies are bound to NEXTAUTH_URL's domain, so auth cannot
  // work on the deployment URL (*.vercel.app deployment hash URLs).
  const canonicalOrigin = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
  if (canonicalOrigin) {
    const canonical = new URL(canonicalOrigin);
    if (req.nextUrl.hostname !== canonical.hostname) {
      const target = new URL(req.nextUrl.pathname + req.nextUrl.search, canonical.origin);
      return NextResponse.redirect(target, { status: 301 });
    }
  }

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

  // SUPER_ADMIN has no schoolId, so school-scoped pages have nothing to show them.
  // Redirect stray direct navigation to the page built for their role.
  const user = req.auth.user;
  const SUPER_ADMIN_ALLOWED = ["/dashboard", "/schools", "/analytics", "/settings"];
  if (
    user?.role === "SUPER_ADMIN" &&
    !SUPER_ADMIN_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.redirect(new URL("/schools", req.url));
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
  // Next.js 15.2+ supports Node.js middleware runtime (experimental).
  // This avoids Edge runtime limitations when importing Node-only deps.
  runtime: "nodejs",
};
