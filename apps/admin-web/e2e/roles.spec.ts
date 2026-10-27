import { expect, test, type Page } from "@playwright/test";
import { SEEDED, SUPER_ADMIN } from "./env";
import { signIn } from "./helpers";

/** Opens each path in turn and expects to be sent to `landing` instead. */
async function expectTurnedAway(page: Page, paths: string[], landing: RegExp) {
  for (const path of paths) {
    await page.goto(path);
    await expect(page, `${path} should be refused`).toHaveURL(landing);
  }
}

const sidebarLink = (page: Page, name: string) =>
  page.getByRole("complementary").getByRole("link", { name, exact: true });

test("nobody signed in gets past the login page", async ({ page }) => {
  await expectTurnedAway(
    page,
    ["/dashboard", "/students", "/fees", "/schools", "/billing"],
    /\/login$/,
  );
});

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("admin@school.edu.in").fill(SEEDED.teacher.email);
  await page.getByPlaceholder("••••••••").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("the super admin runs the platform, not a school", async ({ page }) => {
  await signIn(page, SUPER_ADMIN.email, SUPER_ADMIN.password);
  await expect(page.getByText("Kora SaaS Platform Management")).toBeVisible();
  await expect(sidebarLink(page, "Schools")).toBeVisible();
  await expect(sidebarLink(page, "Students")).toHaveCount(0);

  await expectTurnedAway(
    page,
    ["/students", "/fees", "/attendance", "/setup", "/billing"],
    /\/schools$/,
  );
});

test("a school admin runs their school, not the platform", async ({ page }) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await expect(
    page.getByRole("main").getByText(`${SEEDED.school} ·`),
  ).toBeVisible();
  await expect(sidebarLink(page, "Teachers / Staff")).toBeVisible();
  await expect(sidebarLink(page, "Schools")).toHaveCount(0);

  await expectTurnedAway(page, ["/schools", "/subscriptions"], /\/dashboard$/);
  await expectTurnedAway(
    page,
    ["/settings/platform"],
    /\/settings\/school-profile$/,
  );
});

test("a teacher gets the classroom, not the office", async ({ page }) => {
  await signIn(page, SEEDED.teacher.email, SEEDED.teacher.password);
  await expect(sidebarLink(page, "Attendance")).toBeVisible();
  for (const name of ["Fees", "Expenses", "Teachers / Staff", "Settings"]) {
    await expect(sidebarLink(page, name)).toHaveCount(0);
  }

  await expectTurnedAway(
    page,
    [
      "/teachers",
      "/classes",
      "/expenses",
      "/ledger",
      "/schools",
      "/subscriptions",
    ],
    /\/dashboard$/,
  );
});
