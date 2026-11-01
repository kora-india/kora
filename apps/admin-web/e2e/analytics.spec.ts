import { SEEDED } from "./env";
import { expect, signIn, test } from "./helpers";

test("the analytics page narrows to a period, class and section", async ({
  page,
}, testInfo) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/analytics");
  const main = page.getByRole("main");
  const enrolled = main
    .locator("div")
    .filter({ hasText: /^Enrolled Students\d+/ })
    .last();
  await expect(main.getByText(/^Showing .* · All classes$/)).toBeVisible();
  await expect(enrolled).toBeVisible();
  const allStudents = (await enrolled.textContent())!;

  // Sections wait for a class.
  await expect(main.getByLabel("Section")).toBeDisabled();

  await main.getByLabel("Class", { exact: true }).click();
  await page.getByTitle("Class 4", { exact: true }).click();
  await expect(page).toHaveURL(/class=/);
  await expect(main.getByText(/· Class 4$/)).toBeVisible();
  await expect(enrolled).not.toHaveText(allStudents);

  await expect(main.getByLabel("Section")).toBeEnabled();
  await main.getByLabel("Section").click();
  await page.getByTitle("A", { exact: true }).click();
  await expect(page).toHaveURL(/section=/);
  await expect(main.getByText(/· Class 4 · Section A$/)).toBeVisible();

  await main.getByLabel("Period").click();
  await page.getByTitle("Last month", { exact: true }).click();
  await expect(page).toHaveURL(/period=last_month/);
  await expect(
    main.getByText(/vs the month before|In this period/),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("filtered.png"),
    fullPage: true,
  });

  // The filters are in the link, so a reload or a shared link keeps them.
  await page.reload();
  await expect(main.getByText(/· Class 4 · Section A$/)).toBeVisible();

  // Nothing happened for this group, and the cards don't call that 0%.
  await page.goto("/analytics?period=custom&from=2020-01-01&to=2020-01-31");
  await expect(main.getByText("Nothing billed in this period")).toBeVisible();
  await expect(main.getByText("Not marked in this period")).toBeVisible();

  await main.getByRole("button", { name: "Reset" }).click();
  await expect(page).toHaveURL(/\/analytics$/);
  await expect(main.getByText(/^Showing .* · All classes$/)).toBeVisible();
  await expect(enrolled).toHaveText(allStudents);
  await page.screenshot({
    path: testInfo.outputPath("default.png"),
    fullPage: true,
  });
});
