import { createLogger } from "@schoolos/logger";

/**
 * Environment checks, run once when the server starts (instrumentation.ts).
 *
 * Essentials stop the server with a clear list. A missing feature setting
 * logs what won't work, instead of failing silently the first time someone
 * pays, resets a password or the monthly fee job runs (sec 9).
 */

type Env = Record<string, string | undefined>;

interface Feature {
  name: string;
  /** Every entry must be set; "A|B" means either. */
  vars: string[];
  /** What breaks without it. */
  effect: string;
}

const FEATURES: Feature[] = [
  {
    name: "Payments (Razorpay)",
    vars: [
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "NEXT_PUBLIC_RAZORPAY_KEY_ID",
    ],
    effect: "schools can't pay for a plan or renew",
  },
  {
    name: "Scheduled jobs",
    vars: ["CRON_SECRET"],
    effect: "monthly fees and late fees won't be generated",
  },
  {
    name: "Email (SMTP)",
    vars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD|SMTP_PASS"],
    effect: "sign-up codes, password resets and salary slips can't be sent",
  },
  {
    name: "Redis (Upstash)",
    vars: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    effect:
      "rate limits and caches only work per server instance and reset on cold starts",
  },
  {
    name: "Uploads (Cloudinary)",
    vars: [
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ],
    effect: "school logos can't be uploaded",
  },
  {
    name: "Super admin",
    vars: ["SUPER_ADMIN_EMAIL", "SUPER_ADMIN_PASSWORD"],
    effect:
      "the super admin login isn't created or updated from the environment",
  },
  {
    name: "AI timetable (Gemini)",
    vars: ["GEMINI_API_KEY"],
    effect: "timetables are made by Kora's built-in scheduler only",
  },
];

const isSet = (env: Env, name: string) =>
  name.split("|").some((n) => Boolean(env[n]?.trim()));

const isUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export function checkEnv(env: Env = process.env) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!env.DATABASE_URL || !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
    errors.push("DATABASE_URL must be a postgres:// connection string");
  }
  const secret = env.AUTH_SECRET || env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    errors.push(
      "AUTH_SECRET (or NEXTAUTH_SECRET) must be at least 32 characters",
    );
  }

  for (const name of ["NEXTAUTH_URL", "AUTH_URL", "NEXT_PUBLIC_APP_URL"]) {
    const value = env[name];
    if (value && !isUrl(value)) warnings.push(`${name} is not a valid URL`);
  }
  if (env.SMTP_PORT && !/^\d+$/.test(env.SMTP_PORT)) {
    warnings.push("SMTP_PORT must be a number");
  }
  if (env.CRON_SECRET && env.CRON_SECRET.length < 16) {
    warnings.push("CRON_SECRET is short; use at least 16 random characters");
  }
  if (!env.SMTP_PASSWORD && env.SMTP_PASS) {
    warnings.push("SMTP_PASS is deprecated; rename it to SMTP_PASSWORD");
  }

  for (const feature of FEATURES) {
    const missing = feature.vars.filter((v) => !isSet(env, v));
    if (missing.length > 0) {
      warnings.push(
        `${feature.name}: ${missing.join(", ")} not set, so ${feature.effect}`,
      );
    }
  }

  return { errors, warnings };
}

/** Logs the result; in production, missing essentials stop the server. */
export function reportEnvironment(env: Env = process.env) {
  const logger = createLogger("env");
  const { errors, warnings } = checkEnv(env);
  for (const warning of warnings) logger.warn(warning);
  if (errors.length === 0) return;
  const message = `Invalid environment:\n${errors.map((e) => `  - ${e}`).join("\n")}\nSee .env.example.`;
  if (env.NODE_ENV === "production") throw new Error(message);
  logger.error(message);
}
