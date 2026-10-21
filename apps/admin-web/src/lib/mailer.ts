import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let warnedLegacyPassword = false;

/**
 * The one mailer for every email (U5): OTPs, password resets and salary
 * slips. The password is SMTP_PASSWORD; SMTP_PASS, which the OTP route and CI
 * used to read, still works but logs a warning.
 */
function smtpPassword() {
  const { SMTP_PASSWORD, SMTP_PASS } = process.env;
  if (!SMTP_PASSWORD && SMTP_PASS && !warnedLegacyPassword) {
    warnedLegacyPassword = true;
    logger.warn("SMTP_PASS is deprecated; rename it to SMTP_PASSWORD");
  }
  return SMTP_PASSWORD || SMTP_PASS;
}

export function isMailConfigured() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER } = process.env;
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && smtpPassword());
}

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER } = process.env;
  if (!isMailConfigured()) {
    throw new Error(
      "SMTP is not configured — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD",
    );
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: smtpPassword() },
  });
  return transporter;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  const from =
    process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@kora.app";
  try {
    await getTransporter().sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return { success: true };
  } catch (e: any) {
    logger.error("Failed to send email", {
      error: e.message,
      to: options.to,
      subject: options.subject,
    });
    return { success: false, error: e.message };
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (process.env.NODE_ENV === "development") {
    console.log("\n==============================================");
    console.log("🔒 Password Reset Link (Development Mode)");
    console.log("==============================================");
    console.log(`URL: ${resetUrl}`);
    console.log("==============================================\n");
  }

  return sendMail({
    to,
    subject: "Reset your Kora password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Reset your password</h2>
        <p>We received a request to reset the password for your Kora account.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Reset Password</a></p>
        <p style="color:#666;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}
