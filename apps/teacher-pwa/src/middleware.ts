import { auth } from "@schoolos/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/login")) return NextResponse.next();
  if (!req.auth) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
