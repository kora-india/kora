import { SEEDED } from "./env";
import { expect, signIn, test } from "./helpers";

test("a fee taken shows on the ledger with who took it, and in the activity log", async ({
  page,
}, testInfo) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/fees");
  const search = page.getByPlaceholder(
    "Search student by name or roll number...",
  );
  // The tab content fades in; for a moment the old and new copies overlap.
  await expect(search).toHaveCount(1);
  await search.fill("Vikas");
  await page.getByRole("button", { name: /Vikas Kumar/ }).click();
  await page.getByPlaceholder("e.g. 6000").fill("500");
  await page.getByRole("button", { name: "Allocate Oldest First" }).click();
  await page.getByRole("button", { name: "Preview Allocation" }).click();
  await page.getByRole("button", { name: "Confirm & Print Receipt" }).click();
  const receiptNo = (
    await page
      .getByText(/^RCP-\d{4}-\d{5}$/)
      .first()
      .textContent()
  )?.trim();
  expect(receiptNo).toMatch(/^RCP-\d{4}-\d{5}$/);

  await page.goto("/ledger");
  // Only the page itself: the app can briefly hold a copy for animations.
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Ledger" })).toBeVisible();
  for (const total of ["Collected", "Spent", "Net", "Outstanding dues"]) {
    await expect(main.getByText(total, { exact: true })).toBeVisible();
  }
  const row = main.getByRole("row").filter({ hasText: receiptNo! });
  await expect(row).toContainText("Vikas Kumar");
  await expect(row).toContainText("+₹500");
  await expect(row).toContainText("Test Admin");
  await page.screenshot({
    path: testInfo.outputPath("ledger.png"),
    fullPage: true,
  });

  await main.getByRole("tab", { name: "Expenses" }).click();
  await expect(page).toHaveURL(/\/ledger\?stream=outflow$/);
  await expect(
    main.getByRole("row").filter({ hasText: receiptNo! }),
  ).toHaveCount(0);

  await main.getByRole("link", { name: "Activity" }).click();
  await expect(page).toHaveURL(/\/ledger\?tab=activity$/);
  await expect(
    main.getByRole("button", {
      name: `Collected ₹500 from Vikas Kumar by Cash (receipt ${receiptNo})`,
    }),
  ).toBeVisible();
  await expect(
    main.getByRole("button", { name: "Signed in", exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("activity.png"),
    fullPage: true,
  });

  await main
    .getByRole("button", { name: /^Collected ₹500 from Vikas Kumar/ })
    .click();
  const details = page.getByRole("dialog");
  await expect(details.getByText("Activity details")).toBeVisible();
  await expect(details).toContainText("Test Admin · Admin");
  await expect(details).toContainText("Receipt no");
  await page.screenshot({ path: testInfo.outputPath("activity-details.png") });
});

test("the fees page has no logs tab; its old link opens the ledger", async ({
  page,
}) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/fees?tab=logs");
  await expect(page).toHaveURL(/\/ledger$/);
  await page.goto("/fees");
  await expect(
    page.getByRole("button", { name: "Fee Collection" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Logs & Activities" }),
  ).toHaveCount(0);
});
