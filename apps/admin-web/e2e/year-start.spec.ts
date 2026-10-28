import type { Page } from "@playwright/test";
import { SEEDED } from "./env";
import { expect, signIn, test } from "./helpers";

/** "Class 3 · A" for a student, from the Students list. */
async function placementOf(page: Page, name: string) {
  await page.goto(`/students?q=${encodeURIComponent(name)}`);
  const row = page.getByRole("main").getByRole("row").filter({ hasText: name });
  await expect(row).toHaveCount(1);
  return (await row.getByText(/^Class \d+ · [A-Z]$/).textContent())?.trim();
}

test("the school admin promotes every class, keeps a repeater, and can undo it", async ({
  page,
}) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  expect(await placementOf(page, "Rahul Kumar")).toBe("Class 3 · A");
  expect(await placementOf(page, "Aman Kumar")).toBe("Class 3 · A");

  await page.getByRole("button", { name: "Promote" }).click();
  const dialog = page.getByRole("dialog", { name: "Promote students" });
  // Each class goes to the next one; the top class graduates.
  await expect(dialog.getByLabel(/^Class 2/)).toHaveValue(/^class:/);
  await expect(
    dialog.getByLabel(/^Class 2/).locator("option:checked"),
  ).toHaveText("Class 3");
  await expect(
    dialog.getByLabel(/^Class 5/).locator("option:checked"),
  ).toHaveText("Graduates (leaves school)");

  // Aman repeats Class 3.
  await dialog.getByLabel("Find a student").fill("Aman");
  await dialog
    .getByRole("listitem")
    .filter({ hasText: "Aman Kumar" })
    .getByRole("button", { name: "Repeats the year" })
    .click();
  await expect(dialog.getByText("Aman Kumar: repeats")).toBeVisible();

  await dialog.getByRole("button", { name: "Review" }).click();
  await expect(dialog.getByText("1 student repeats their class")).toBeVisible();
  await expect(dialog.getByText(/students move up/)).toBeVisible();
  await dialog.getByRole("button", { name: /^Promote \d+ students$/ }).click();
  await expect(dialog.getByText("Promotion done")).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();

  expect(await placementOf(page, "Rahul Kumar")).toBe("Class 4 · A");
  expect(await placementOf(page, "Aman Kumar")).toBe("Class 3 · A");

  // Changed your mind: undo puts everyone back.
  await page.getByRole("button", { name: "Promote" }).click();
  await dialog.getByRole("button", { name: "Undo it" }).click();
  await dialog.getByRole("button", { name: "Yes, undo it" }).click();
  await expect(page.getByText(/^Undone: \d+ students are back/)).toBeVisible();
  await page.keyboard.press("Escape");

  expect(await placementOf(page, "Rahul Kumar")).toBe("Class 3 · A");
});

test("next year's fees start as a copy of this year's, 8% higher", async ({
  page,
}) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/fees?tab=settings");

  // Next year's session, not current yet.
  await page.getByRole("button", { name: "Add Session" }).click();
  const sessionDialog = page.getByRole("dialog");
  await sessionDialog.getByPlaceholder("e.g. 2026-27").fill("2027-28");
  const dates = sessionDialog.locator('input[type="date"]');
  await dates.nth(0).fill("2027-04-01");
  await dates.nth(1).fill("2028-03-31");
  await sessionDialog.getByRole("button", { name: "Create Session" }).click();
  await expect(sessionDialog).toBeHidden();

  await page
    .getByLabel("Session", { exact: true })
    .selectOption({ label: "2027-28" });
  await expect(
    page.getByText("2027-28 has no fee structures yet."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Copy from another year" })
    .last()
    .click();

  const dialog = page.getByRole("dialog", { name: "Copy fee structures" });
  await expect(
    dialog.getByLabel("Copy from").locator("option:checked"),
  ).toHaveText("2026-27");
  await expect(
    dialog.getByLabel("Copy to").locator("option:checked"),
  ).toHaveText("2027-28");
  await dialog.getByLabel("Change fees by (%)").fill("8");
  await expect(
    dialog.getByText("3 of 3 structures will be copied"),
  ).toBeVisible();
  await expect(dialog.getByText(/→/).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Copy 3 structures" }).click();

  await expect(
    page.getByText(/^Copied 3 fee structures to 2027-28, 4 classes assigned/),
  ).toBeVisible();
  const cards = page
    .getByRole("heading", { level: 3 })
    .filter({ hasText: /Structure$/ });
  await expect(cards).toHaveCount(3);
  await expect(
    page.getByText("2027-28", { exact: true }).first(),
  ).toBeVisible();
});
