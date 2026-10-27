import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

/**
 * What the end-to-end servers run with. Every setting in the real .env files
 * is blanked first and only these values are set, so a run can't reach a real
 * database, mailbox, payment account or cache, and no live key is built into
 * the pages. e2e/serve.mjs refuses any database that isn't local and named
 * for tests, because each run wipes it.
 */

export const APP_PORT = 3100;
export const SMTP_PORT = 3125;
export const MAILBOX_PORT = 3126;
export const APP_URL = `http://localhost:${APP_PORT}`;
export const MAILBOX_URL = `http://127.0.0.1:${MAILBOX_PORT}`;

export const SUPER_ADMIN = {
  email: "owner@kora-e2e.test",
  password: "e2e-super-admin-password",
};

/** Made by packages/db/src/seed.ts, which every run starts from. */
export const SEEDED = {
  school: "Delhi Public School - Test",
  schoolAdmin: { email: "admin@test-dps.com", password: "test1234" },
  teacher: { email: "amit@test-dps.com", password: "test1234" },
};

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:password@localhost:5432/schoolos_e2e?schema=public";

const ROOT = path.resolve(__dirname, "../../..");

// The files Next.js (production mode), Prisma and the seed read.
const ENV_FILES = [
  "apps/admin-web/.env",
  "apps/admin-web/.env.local",
  "apps/admin-web/.env.production",
  "apps/admin-web/.env.production.local",
  "packages/db/.env",
  ".env",
];

/** What the .env files hold; for a key in several, the first file listed. */
function envFileSettings() {
  const settings: Record<string, string> = {};
  for (const file of ENV_FILES) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    for (const [key, value] of Object.entries(parse(fs.readFileSync(full)))) {
      settings[key] ??= value;
    }
  }
  return settings;
}

export function e2eEnv(): Record<string, string> {
  const fileSettings = envFileSettings();
  // Each setting from the files, as "": a set variable beats the file.
  const blanked = Object.fromEntries(
    Object.keys(fileSettings)
      .filter((key) => key !== "NODE_ENV")
      .map((key) => [key, ""]),
  );
  // The one setting taken from the files: where the tests may wipe and seed.
  const databaseUrl =
    process.env.E2E_DATABASE_URL ||
    fileSettings.E2E_DATABASE_URL ||
    DEFAULT_DATABASE_URL;
  const authSecret = "e2e-auth-secret-not-for-real-use-0123456789";
  return {
    ...blanked,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    AUTH_SECRET: authSecret,
    NEXTAUTH_SECRET: authSecret,
    AUTH_URL: APP_URL,
    NEXTAUTH_URL: APP_URL,
    NEXT_PUBLIC_APP_URL: APP_URL,
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_TELEMETRY_DISABLED: "1",
    APP_PORT: String(APP_PORT),
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(SMTP_PORT),
    SMTP_USER: "e2e",
    SMTP_PASSWORD: "e2e",
    SMTP_FROM: "Kora <no-reply@kora-e2e.test>",
    MAILBOX_PORT: String(MAILBOX_PORT),
    SUPER_ADMIN_EMAIL: SUPER_ADMIN.email,
    SUPER_ADMIN_PASSWORD: SUPER_ADMIN.password,
    CRON_SECRET: "e2e-cron-secret-0123456789",
    SENTRY_DSN: "",
    NEXT_PUBLIC_SENTRY_DSN: "",
    SENTRY_AUTH_TOKEN: "",
  };
}
