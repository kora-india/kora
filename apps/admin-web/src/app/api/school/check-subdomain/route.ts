import { NextResponse } from "next/server";
import { auth } from "@schoolos/auth";
import { subdomainRatelimit, createRateLimitResponse } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip";
import { z } from "zod";
import { isSubdomainAvailable } from "@/lib/billing";

const Schema = z.object({
  subdomain: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimitResult = await subdomainRatelimit.limit(ip);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        rateLimitResult,
        "Too many school ID checks. Please wait a minute before checking again.",
      );
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subdomain } = Schema.parse(body);

    // U3: someone else's checkout or unused payment also holds a subdomain.
    const available = await isSubdomainAvailable(subdomain, session.user.id);

    return NextResponse.json({ available });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Invalid input" },
      { status: 400 },
    );
  }
}
