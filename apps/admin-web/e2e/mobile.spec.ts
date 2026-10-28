import { SEEDED } from "./env";
import { expect, signIn, test } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

test("on a phone the menu is a drawer that gets out of the way", async ({
  page,
}) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);

  // The page gets the whole width; the menu waits behind a button.
  const menu = page.getByRole("complementary");
  await expect(menu).toBeHidden();
  const main = await page.getByRole("main").boundingBox();
  expect(main?.width).toBeGreaterThan(380);

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "Students", exact: true }).click();

  await expect(page).toHaveURL(/\/students$/);
  await expect(menu).toBeHidden();

  // Escape shuts it too.
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  // Nothing pushes the page sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
