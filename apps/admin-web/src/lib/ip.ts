import { NextRequest } from "next/server";

const firstEntry = (value: string | null) =>
  value?.split(",")[0]?.trim() || null;

/**
 * The client's IP address, for rate limits (sec 9).
 *
 * Proxy headers are only as trustworthy as the proxy that sets them; the
 * client can put anything in `X-Forwarded-For` itself. So:
 * - `CLIENT_IP_HEADER` (e.g. "cf-connecting-ip") names one header your
 *   proxy always sets, and only that is read.
 * - On Vercel, whose edge replaces `X-Forwarded-For`, its first entry is
 *   the client.
 * - `TRUSTED_PROXY_COUNT` (behind your own load balancer, usually 1) takes
 *   the address your outermost proxy saw, counted from the right, which a
 *   client can't forge.
 * - Otherwise the last entry, which the nearest proxy added.
 */
export function getClientIp(req: Request | NextRequest): string {
  const headers = req.headers;

  const named = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (named) return firstEntry(headers.get(named)) ?? "unknown";

  const forwarded = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (process.env.VERCEL) {
    return forwarded[0] ?? firstEntry(headers.get("x-real-ip")) ?? "unknown";
  }

  const trusted = Number.parseInt(process.env.TRUSTED_PROXY_COUNT ?? "", 10);
  if (Number.isFinite(trusted) && trusted > 0 && forwarded.length > 0) {
    return forwarded[Math.max(0, forwarded.length - trusted)];
  }

  return (
    forwarded[forwarded.length - 1] ??
    firstEntry(headers.get("x-real-ip")) ??
    "unknown"
  );
}
