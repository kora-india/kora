import { NextRequest, NextResponse } from "next/server";
import { auth } from "@schoolos/auth";
import { changeOwnPassword } from "@schoolos/auth/password";

/** The signed-in teacher changes their own password (same rules as the admin app). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await changeOwnPassword(
    session.user.id,
    await req.json().catch(() => null),
  );
  return NextResponse.json(result, { status: result.error ? 400 : 200 });
}
