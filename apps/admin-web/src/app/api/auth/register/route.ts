import { NextResponse } from "next/server";
import { prisma } from "@schoolos/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  otp: z.string().length(6),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, otp } = RegisterSchema.parse(body);

    // 1. Verify OTP
    const otpRecord = await prisma.otp.findFirst({
      where: { email, otp },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    if (otpRecord.expiresAt < new Date()) {
      return NextResponse.json({ error: "OTP has expired" }, { status: 400 });
    }

    // 2. Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "Email is already registered" }, { status: 400 });
    }

    // 3. Create user
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "SCHOOL_ADMIN",
      },
    });

    // 4. Cleanup OTP
    await prisma.otp.deleteMany({ where: { email } });

    // Note: We don't sign in the user here using next-auth because next-auth
    // usually handles session creation via its own endpoints or credentials provider on the client.
    // The client should call signIn('credentials') after this succeeds.

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input data" }, { status: 400 });
    }
    console.error("Error in registration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
