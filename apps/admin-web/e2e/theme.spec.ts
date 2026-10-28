import type { Page } from "@playwright/test";
import { THEME_COLORS } from "@schoolos/types";
import { SEEDED } from "./env";
import { expect, newContext, signIn, test } from "./helpers";

/** The theme color the page is using, as the --brand-600 variable. */
const brandColor = (page: Page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--brand-600")
      .trim(),
  );

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

/** Clicks an appearance option and waits until the server has saved it. */
async function chooseAppearance(page: Page, option: string) {
  const saved = page.waitForResponse(
    (res) =>
      res.request().method() === "POST" &&
      res.request().headers()["next-action"] !== undefined,
  );
  const appearance = page.getByRole("radiogroup", { name: "Appearance" });
  await appearance.getByText(option, { exact: true }).click();
  await expect(appearance.getByRole("radio", { name: option })).toBeChecked();
  expect((await saved).ok()).toBe(true);
}

test("the school admin's theme color reaches everyone at the school", async ({
  page,
  browser,
  baseURL,
}) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/settings/school-profile");
  const colors = page.getByRole("radiogroup", { name: "Theme color" });
  await colors.getByText("Green", { exact: true }).click();
  await expect(colors.getByRole("radio", { name: "Green" })).toBeChecked();
  await expect(page.getByText("Theme color changed to Green")).toBeVisible();
  expect(await brandColor(page)).toBe(THEME_COLORS.green.palette[600]);

  // After a full load the color comes from the server, not the preview.
  await page.reload();
  expect(await brandColor(page)).toBe(THEME_COLORS.green.palette[600]);

  const context = await newContext(browser, baseURL);
  const teacherPage = await context.newPage();
  await signIn(teacherPage, SEEDED.teacher.email, SEEDED.teacher.password);
  expect(await brandColor(teacherPage)).toBe(THEME_COLORS.green.palette[600]);
  // Teachers don't get to change it.
  await teacherPage.goto("/settings/school-profile");
  await expect(
    teacherPage.getByRole("radiogroup", { name: "Theme color" }),
  ).toHaveCount(0);
  await context.close();
});

test("a light/dark choice follows the person to another browser", async ({
  page,
  browser,
  baseURL,
}) => {
  await signIn(page, SEEDED.teacher.email, SEEDED.teacher.password);
  await page.goto("/settings/account");
  await chooseAppearance(page, "Dark");
  await expect.poll(() => isDark(page)).toBe(true);

  const context = await newContext(browser, baseURL);
  const elsewhere = await context.newPage();
  await signIn(elsewhere, SEEDED.teacher.email, SEEDED.teacher.password);
  await expect.poll(() => isDark(elsewhere)).toBe(true);

  // Leave the shared seed account as other tests expect it.
  await chooseAppearance(page, "Light");
  await expect.poll(() => isDark(page)).toBe(false);
  await context.close();
});
