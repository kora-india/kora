import { SEEDED } from "./env";
import { expect, signIn, test } from "./helpers";

test("probe screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 860 });
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/settings/school-profile");
  const colors = page.getByRole("radiogroup", { name: "Theme color" });
  await colors.getByText("Maroon", { exact: true }).click();
  await expect(page.getByText("Theme color changed to Maroon")).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: "/private/tmp/claude-501/-Users-kanhaiyapandey-projects-schoolos/cc23dc59-16f1-42ed-bafe-d321e6829070/scratchpad/t-profile-maroon.png",
    fullPage: true,
  });
  await page.goto("/dashboard");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: "/private/tmp/claude-501/-Users-kanhaiyapandey-projects-schoolos/cc23dc59-16f1-42ed-bafe-d321e6829070/scratchpad/t-dashboard-maroon.png",
  });
  await page.goto("/students");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: "/private/tmp/claude-501/-Users-kanhaiyapandey-projects-schoolos/cc23dc59-16f1-42ed-bafe-d321e6829070/scratchpad/t-students-maroon.png",
  });
  await page.goto("/settings/account");
  await page
    .getByRole("radiogroup", { name: "Appearance" })
    .getByText("Dark", { exact: true })
    .click();
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: "/private/tmp/claude-501/-Users-kanhaiyapandey-projects-schoolos/cc23dc59-16f1-42ed-bafe-d321e6829070/scratchpad/t-account-dark.png",
    fullPage: true,
  });
  await page.goto("/dashboard");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: "/private/tmp/claude-501/-Users-kanhaiyapandey-projects-schoolos/cc23dc59-16f1-42ed-bafe-d321e6829070/scratchpad/t-dashboard-dark.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings/school-profile");
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: "/private/tmp/claude-501/-Users-kanhaiyapandey-projects-schoolos/cc23dc59-16f1-42ed-bafe-d321e6829070/scratchpad/t-profile-mobile-dark.png",
    fullPage: true,
  });
});
