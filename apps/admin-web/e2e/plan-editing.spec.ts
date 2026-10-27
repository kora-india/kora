import { expect, test } from "@playwright/test";
import { SUPER_ADMIN } from "./env";
import {
  fillSchoolDetails,
  signIn,
  signUp,
  stubThirdParties,
  uniqueId,
} from "./helpers";

test("a plan the super admin edits shows on the landing page and at sign-up", async ({
  page,
  browser,
  baseURL,
}) => {
  await stubThirdParties(page);
  const pricing = page.locator("#pricing");
  const benefit = "Priority onboarding call";

  // A visitor sees the default Basic plan first.
  await page.goto("/");
  await expect(
    pricing.getByRole("heading", { name: "Basic", exact: true }),
  ).toBeVisible();
  await expect(pricing.getByText(benefit)).toHaveCount(0);

  const admin = await browser.newContext({ baseURL });
  const adminPage = await admin.newPage();
  await signIn(adminPage, SUPER_ADMIN.email, SUPER_ADMIN.password);
  await adminPage.goto("/subscriptions");
  await adminPage.getByRole("button", { name: "Edit Basic plan" }).click();

  const dialog = adminPage.getByRole("dialog");
  await dialog.getByLabel("Plan name").fill("Starter");
  await dialog.getByLabel("Monthly price (₹)").fill("1234");
  await dialog.getByRole("button", { name: "Add benefit" }).click();
  await dialog
    .getByRole("textbox", { name: /^Benefit \d+$/ })
    .last()
    .fill(benefit);
  await dialog.getByRole("button", { name: "Save plan" }).click();
  await expect(adminPage.getByText("Starter plan saved")).toBeVisible();
  await expect(dialog).toBeHidden();
  await admin.close();

  await page.reload();
  await expect(
    pricing.getByRole("heading", { name: "Starter", exact: true }),
  ).toBeVisible();
  await expect(pricing.getByText("₹1,234")).toBeVisible();
  await expect(pricing.getByText(benefit)).toBeVisible();

  // Signing up, the visitor is offered the edited plan at its new price.
  const id = uniqueId();
  await signUp(page, {
    name: "Ravi Kumar",
    email: `ravi.${id}@example.com`,
    password: "lakeview-password",
  });
  await fillSchoolDetails(page, `Lakeview School ${id}`);
  await page
    .getByRole("radio", { name: "Starter, ₹1,234 a month" })
    .check({ force: true });
  await expect(
    page.getByRole("button", { name: "Pay ₹1,234 & create school" }),
  ).toBeVisible();
});
