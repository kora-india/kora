import { NextResponse } from "next/server";
import { prisma } from "@schoolos/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version ?? "unknown",
        database: { status: "connected", latencyMs: latency },
        environment: process.env.NODE_ENV,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        database: { status: "disconnected" },
        error: process.env.NODE_ENV === "production" ? "Database unavailable" : String(error),
      },
      { status: 503 }
    );
  }
}
