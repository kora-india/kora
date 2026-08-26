import { NextRequest } from "next/server";

/**
 * Extracts client IP address from request headers with support for standard proxies
 */
export function getClientIp(req: Request | NextRequest): string {
  const headers = req.headers;

  // Standard proxy headers
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for may contain a comma-separated list of IPs: "client, proxy1, proxy2"
    const clientIp = forwardedFor.split(",")[0]?.trim();
    if (clientIp) return clientIp;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  return "127.0.0.1";
}
