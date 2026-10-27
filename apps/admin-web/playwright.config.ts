import { defineConfig, devices } from "@playwright/test";
import { APP_URL, MAILBOX_URL, e2eEnv } from "./e2e/env";

/**
 * End-to-end tests against the production build (`pnpm test:e2e`).
 *
 * Needs a local Postgres; each run wipes the database in E2E_DATABASE_URL,
 * from the shell or a .env file (default:
 * postgres:password@localhost:5432/schoolos_e2e). The app is built
 * into .next-e2e and served on port 3100, so a dev server can keep running.
 * Email goes to e2e/mail-catcher.mjs, never to a real inbox.
 */

const env = e2eEnv();

export default defineConfig({
  testDir: "./e2e",
  // One shared server and database; the plan test changes what others see.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/mail-catcher.mjs",
      url: `${MAILBOX_URL}/messages`,
      env,
    },
    {
      command: "node e2e/serve.mjs",
      url: `${APP_URL}/api/health`,
      env,
      // Wiping the database, seeding and building come first.
      timeout: 10 * 60_000,
      stdout: "pipe",
    },
  ],
});
