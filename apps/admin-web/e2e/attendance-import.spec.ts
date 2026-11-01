import fs from "node:fs";
import { read, utils, write } from "xlsx";
import { SEEDED } from "./env";
import { expect, signIn, test } from "./helpers";

const EXCEL =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

test("a school imports a section's past attendance and can undo it", async ({
  page,
}, testInfo) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/attendance");
  await page.getByRole("button", { name: "Import Attendance" }).click();
  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Class", { exact: true }).selectOption("Class 3");
  await dialog.getByLabel("Section", { exact: true }).selectOption("B");
  await dialog.getByLabel("From", { exact: true }).fill("2026-05");
  await dialog.getByLabel("To", { exact: true }).fill("2026-06");
  await page.screenshot({ path: testInfo.outputPath("start.png") });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download Template" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("attendance-class-3-b.xlsx");
  const book = read(fs.readFileSync(await download.path()));
  expect(book.SheetNames).toEqual(["May 2026", "Jun 2026", "Instructions"]);

  const rows = utils.sheet_to_json<string[]>(book.Sheets["May 2026"], {
    header: 1,
    defval: "",
  });
  const headers = rows[0];
  expect(headers.slice(0, 4)).toEqual([
    "Admission No",
    "Student Name",
    "Roll No",
    "1 Fri",
  ]);
  expect(headers.at(-1)).toBe("31 Sun");
  const students = rows.slice(1);
  expect(students.length).toBeGreaterThan(0);

  const present = headers.indexOf("1 Fri");
  const absent = headers.indexOf("4 Mon");
  students[0][present] = "P";
  students[0][absent] = "A";
  const filled = utils.book_new();
  utils.book_append_sheet(
    filled,
    utils.aoa_to_sheet([headers, ...students]),
    "May 2026",
  );
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "attendance.xlsx",
    mimeType: EXCEL,
    buffer: write(filled, { type: "buffer", bookType: "xlsx" }),
  });

  await expect(
    dialog.getByRole("button", { name: "Import 2 records" }),
  ).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("check.png") });
  await dialog.getByRole("button", { name: "Import 2 records" }).click();
  await expect(dialog.getByText("Attendance imported")).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Import Attendance" }).click();
  await expect(dialog.getByText("Class 3 B · May 2026")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("past-imports.png") });

  // A second upload of the same file has nothing to add.
  await dialog.getByLabel("Class", { exact: true }).selectOption("Class 3");
  await dialog.getByLabel("Section", { exact: true }).selectOption("B");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "attendance.xlsx",
    mimeType: EXCEL,
    buffer: write(filled, { type: "buffer", bookType: "xlsx" }),
  });
  await expect(dialog.getByText(/2 records already are in Kora/)).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Import 0 records" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Back" }).click();

  await dialog
    .getByRole("button", { name: /^Undo import for Class 3 B/ })
    .click();
  await page.getByRole("button", { name: "Undo Import" }).click();
  await expect(dialog.getByText("Undone")).toBeVisible();

  // Gone again, so the same file can come back in.
  await dialog.getByLabel("Class", { exact: true }).selectOption("Class 3");
  await dialog.getByLabel("Section", { exact: true }).selectOption("B");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "attendance.xlsx",
    mimeType: EXCEL,
    buffer: write(filled, { type: "buffer", bookType: "xlsx" }),
  });
  await expect(
    dialog.getByRole("button", { name: "Import 2 records" }),
  ).toBeEnabled();
});

test("a mistake in the file is named, with nothing saved", async ({ page }) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/attendance");
  await page.getByRole("button", { name: "Import Attendance" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Class", { exact: true }).selectOption("Class 3");
  await dialog.getByLabel("Section", { exact: true }).selectOption("B");

  const book = utils.book_new();
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet([
      ["Admission No", "Student Name", "Roll No", "1 Fri"],
      ["NOT-A-STUDENT", "Nobody", "1", "P"],
    ]),
    "May 2026",
  );
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "attendance.xlsx",
    mimeType: EXCEL,
    buffer: write(book, { type: "buffer", bookType: "xlsx" }),
  });

  await expect(dialog.getByRole("alert")).toContainText(
    "May 2026, row 2: Admission number NOT-A-STUDENT isn't in Class 3-B",
  );
  await expect(dialog.getByRole("alert")).toContainText(
    "Nothing has been saved",
  );
});
