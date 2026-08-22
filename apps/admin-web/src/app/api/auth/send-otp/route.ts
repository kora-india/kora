import { NextResponse } from "next/server";
import { prisma } from "@schoolos/db";
import nodemailer from "nodemailer";
import { z } from "zod";

const SendOtpSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = SendOtpSchema.parse(body);

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "Email is already registered" }, { status: 400 });
    }

    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Save OTP to DB (cleanup old ones if they exist for this email to avoid clutter)
    await prisma.otp.deleteMany({ where: { email } });
    
    await prisma.otp.create({
      data: {
        email,
        otp,
        expiresAt,
      },
    });

    // Send email using Nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #6d28d9; text-align: center;">Welcome to SchoolOS!</h2>
        <p style="font-size: 16px; color: #333;">Hello,</p>
        <p style="font-size: 16px; color: #333;">Thank you for registering. Please use the following One-Time Password (OTP) to complete your registration process:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #6d28d9; letter-spacing: 5px; background: #f3e8ff; padding: 15px 25px; border-radius: 8px;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #666; text-align: center;">This OTP is valid for the next 10 minutes. Please do not share it with anyone.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">If you did not request this email, you can safely ignore it.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"SchoolOS" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your SchoolOS Verification Code",
      html: htmlTemplate,
    });

    return NextResponse.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input data" }, { status: 400 });
    }
    console.error("Error sending OTP:", error);
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}
