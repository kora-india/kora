import fs from "node:fs";
import { read, utils, write } from "xlsx";
import { SEEDED } from "./env";
import { expect, signIn, test } from "./helpers";

test("a school fills in the template, imports its balances, and can undo them", async ({
  page,
}, testInfo) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/fees");
  await page.getByRole("button", { name: "Import Balances" }).click();
  const dialog = page.getByRole("dialog");

  // The template lists the school's own students.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download Template" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("opening-balances-template.xlsx");
  const book = read(fs.readFileSync(await download.path()));
  expect(book.SheetNames).toEqual(["Opening Balances", "Instructions"]);
  const rows = utils.sheet_to_json<(string | number)[]>(
    book.Sheets["Opening Balances"],
    { header: 1, defval: "" },
  );
  expect(rows[0]).toEqual([
    "Admission Number",
    "Student Name",
    "Class",
    "Section",
    "Roll Number",
    "Parent Name",
    "Dues (₹)",
    "Advance (₹)",
  ]);
  const pooja = rows.findIndex((r) => r[1] === "Pooja Kumari");
  expect(pooja).toBeGreaterThan(0);

  // A school types the dues in and uploads the same file.
  rows[pooja][6] = 2500;
  const filled = utils.book_new();
  utils.book_append_sheet(filled, utils.aoa_to_sheet(rows), "Opening Balances");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "balances.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: write(filled, { type: "buffer", bookType: "xlsx" }),
  });

  await expect(dialog.getByText("₹2,500")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("check.png") });
  await dialog.getByRole("button", { name: /^Import \d+ students$/ }).click();
  await expect(dialog.getByText("Balances imported")).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();

  // Collected at the desk like any other bill.
  await page.goto("/fees");
  const search = page.getByPlaceholder(
    "Search student by name or roll number...",
  );
  await expect(search).toHaveCount(1);
  await search.fill("Pooja");
  await page.getByRole("button", { name: /Pooja Kumari/ }).click();
  await expect(
    page.getByRole("button", { name: /^Pay Full Due/ }),
  ).toContainText("₹2,500");

  // One line in the activity log.
  await page.goto("/ledger?tab=activity");
  await expect(
    page.getByRole("main").getByRole("button", {
      name: /^Imported opening balances for \d+ students/,
    }),
  ).toBeVisible();

  // Undone from the same dialog: the dues are gone.
  await page.goto("/fees");
  await page.getByRole("button", { name: "Import Balances" }).click();
  await page.screenshot({ path: testInfo.outputPath("past-imports.png") });
  await dialog.getByRole("button", { name: /^Undo import as of/ }).click();
  await page.getByRole("button", { name: "Undo Import" }).click();
  await expect(dialog.getByText("Undone")).toBeVisible();

  await page.goto("/fees");
  await expect(search).toHaveCount(1);
  await search.fill("Pooja");
  await page.getByRole("button", { name: /Pooja Kumari/ }).click();
  await expect(
    page.getByRole("heading", { name: "Pooja Kumari", level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pay Full Due/ })).toHaveCount(
    0,
  );
});

test("a file with a mistake is stopped, with nothing saved", async ({
  page,
}) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/fees");
  await page.getByRole("button", { name: "Import Balances" }).click();
  const dialog = page.getByRole("dialog");

  await dialog.locator('input[type="file"]').setInputFiles({
    name: "balances.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Admission Number,Dues (₹),Advance (₹)\nNOT-A-STUDENT,500,\n",
    ),
  });

  await expect(dialog.getByRole("alert")).toContainText(
    "Row 2: Admission number NOT-A-STUDENT isn't a student at this school",
  );
  await expect(dialog.getByRole("alert")).toContainText(
    "Nothing has been saved",
  );
  await expect(
    dialog.getByRole("button", { name: /^Import \d+ student/ }),
  ).toBeDisabled();
});
