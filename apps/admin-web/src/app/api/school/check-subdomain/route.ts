import { NextResponse } from "next/server";
import { auth } from "@schoolos/auth";
import { prisma } from "@schoolos/db";
import { z } from "zod";

const Schema = z.object({
  subdomain: z.string().min(3).regex(/^[a-z0-9-]+$/),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subdomain } = Schema.parse(body);

    const existingSchool = await prisma.school.findUnique({
      where: { subdomain },
      select: { id: true },
    });

    return NextResponse.json({ available: !existingSchool });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Invalid input" },
      { status: 400 }
    );
  }
}
