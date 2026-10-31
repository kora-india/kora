import type { Locator } from "@playwright/test";
import { SEEDED } from "./env";
import {
  chooseOwnPassword,
  expect,
  expectTurnedAway,
  lastEmail,
  newContext,
  sidebarLink,
  signIn,
  test,
  uniqueId,
} from "./helpers";

/** Sets one module's level in the access editor. */
async function setAccess(dialog: Locator, module: string, level: string) {
  const group = dialog.getByRole("radiogroup", { name: module, exact: true });
  await group.getByText(level, { exact: true }).click();
  await expect(group.getByRole("radio", { name: level })).toBeChecked();
}

test("the school admin opens fees to a teacher and closes attendance", async ({
  page,
  browser,
  baseURL,
}) => {
  const teacher = SEEDED.otherTeacher;
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/settings/team");
  await page
    .getByRole("button", { name: `Edit access for ${teacher.name}` })
    .click();

  const dialog = page.getByRole("dialog");
  await setAccess(dialog, "Fees", "View");
  await setAccess(dialog, "Attendance", "None");
  await dialog.getByRole("button", { name: "Save access" }).click();
  await expect(page.getByText(`${teacher.name}'s access saved`)).toBeVisible();

  const context = await newContext(browser, baseURL);
  const teacherPage = await context.newPage();
  await signIn(teacherPage, teacher.email, teacher.password);

  // Fees to look at, not to collect.
  await expect(sidebarLink(teacherPage, "Fees")).toBeVisible();
  await expect(teacherPage.getByText("Pending Fees")).toBeVisible();
  await expect(
    teacherPage.getByRole("link", { name: "Collect Fee" }),
  ).toHaveCount(0);
  await teacherPage.goto("/fees");
  await expect(
    teacherPage.getByRole("heading", { name: "Fee Management" }),
  ).toBeVisible();

  await expect(sidebarLink(teacherPage, "Attendance")).toHaveCount(0);
  await expectTurnedAway(teacherPage, ["/attendance"], /\/dashboard$/);
  await context.close();
});

test("an accountant login gets the money pages and nothing else", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  const name = "Meera Accounts";
  const email = `meera.${uniqueId()}@example.com`;
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  // One place for people: Team & access only sets what they can do.
  await page.goto("/settings/team");
  await expect(
    page.getByRole("button", { name: /Add accountant/ }),
  ).toHaveCount(0);
  await page.goto("/teachers?tab=staff");
  await page
    .locator("#tour-teachers-actions")
    .getByRole("button", { name: "Add Staff Member" })
    .click();

  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. Ramesh Kumar").fill(name);
  await dialog.getByPlaceholder("e.g. 9876543210").fill("9000000005");
  await dialog.getByRole("button", { name: "Accountant", exact: true }).click();
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await expect(
    dialog.getByRole("checkbox", { name: /Let them sign in to Kora/ }),
  ).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("add-accountant.png") });
  await dialog.getByRole("button", { name: "Add Staff", exact: true }).click();
  await expect(dialog.getByText("Accountant added")).toBeVisible();
  await expect(
    dialog.getByText(`We've emailed the sign-in details to ${email}`),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Show password" }).click();
  const password = (await dialog.getByTestId("temp-password").textContent())!;
  // The accountant gets the same details by email.
  const welcome = await lastEmail(email, /^Your Kora login for /);
  expect(welcome.subject).toBe(`Your Kora login for ${SEEDED.school}`);
  expect(welcome.html).toContain(password);
  await dialog.getByRole("button", { name: "Done" }).click();
  const card = page.getByRole("main").locator("div", { hasText: name }).last();
  await expect(card).toBeVisible();
  await expect(
    page.getByRole("main").getByText("Signs in to Kora"),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("staff.png") });
  await page.goto("/settings/team");
  await expect(page.getByRole("main").getByText(name)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("team.png") });

  const context = await newContext(browser, baseURL);
  const accountant = await context.newPage();
  // The temporary password opens nothing but the page that replaces it.
  await signIn(accountant, email, password.trim(), /\/change-password$/);
  await expectTurnedAway(accountant, ["/fees"], /\/change-password$/);
  const api = await accountant.request.get("/api/students");
  expect(api.status()).toBe(403);
  await chooseOwnPassword(accountant, password.trim(), "Meera-own-pass-1");

  for (const link of ["Fees", "Expenses", "Ledger", "Transport", "Students"]) {
    await expect(sidebarLink(accountant, link)).toBeVisible();
  }
  for (const link of [
    "Attendance",
    "Notices",
    "Teachers / Staff",
    "Analytics",
  ]) {
    await expect(sidebarLink(accountant, link)).toHaveCount(0);
  }
  await expect(
    accountant.getByRole("link", { name: "Collect Fee" }),
  ).toBeVisible();

  await expectTurnedAway(
    accountant,
    ["/attendance", "/notices", "/teachers", "/analytics"],
    /\/dashboard$/,
  );
  // Team & access is the school admin's alone.
  await expectTurnedAway(
    accountant,
    ["/settings/team"],
    /\/settings\/school-profile$/,
  );
  // So is the activity log: the ledger shows them its transactions only.
  await expectTurnedAway(accountant, ["/ledger?tab=activity"], /\/ledger$/);
  await expect(accountant.getByRole("link", { name: "Activity" })).toHaveCount(
    0,
  );
  // Importing balances changes what parents owe: school admins only.
  await accountant.goto("/fees");
  await expect(
    accountant.getByRole("heading", { name: "Fee Management" }),
  ).toBeVisible();
  await expect(
    accountant.getByRole("button", { name: "Import Balances" }),
  ).toHaveCount(0);
  await expect(
    accountant.getByRole("button", { name: "Import Fee History" }),
  ).toHaveCount(0);
  await context.close();
});
