import fs from "node:fs";
import { read, utils, write } from "xlsx";
import { SEEDED } from "./env";
import { expect, signIn, test, uniqueId } from "./helpers";

test("a blank template brings in new students with their fee history at once", async ({
  page,
}, testInfo) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/students");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page
    .getByRole("button", { name: /^Import students with fee history/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Upload the filled file")).toBeVisible();
  await dialog.getByLabel("From", { exact: true }).fill("2026-08");
  await dialog.getByLabel("To", { exact: true }).fill("2026-09");
  await page.screenshot({ path: testInfo.outputPath("start.png") });

  // Blank: the school's fee heads and late fee as columns, no students.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download Template" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(
    "students-and-fee-history-template.xlsx",
  );
  const book = read(fs.readFileSync(await download.path()));
  expect(book.SheetNames).toEqual(["Students and Fees", "Instructions"]);
  const [headers, ...blank] = utils.sheet_to_json<string[]>(
    book.Sheets["Students and Fees"],
    { header: 1 },
  );
  expect(blank).toEqual([]);
  expect(headers.slice(0, 4)).toEqual([
    "Admission Number",
    "Student Name",
    "Class",
    "Section",
  ]);
  expect(headers).toContain("Aug 2026 Late Fee (₹)");
  const feeHead = headers.find(
    (h) =>
      h.startsWith("Aug 2026") && h.endsWith("(₹)") && !/Late Fee|Paid/.test(h),
  )!;
  expect(feeHead).toBeDefined();

  const id = uniqueId();
  const number = `NEW-${id}`;
  const name = `New Student ${id}`;
  const receipt = `BOOK-${id}`;
  const row = (cells: Record<string, string | number>) =>
    headers.map((h) => cells[h] ?? "");
  const filled = utils.book_new();
  utils.book_append_sheet(
    filled,
    utils.aoa_to_sheet([
      headers,
      row({
        "Admission Number": number,
        "Student Name": name,
        Class: "Class 4",
        Section: "A",
        "Parent Name": "Ravi Kumar",
        "Parent Phone": "9000000001",
        [feeHead]: 2000,
        "Aug 2026 Late Fee (₹)": 100,
        "Aug 2026 Paid (₹)": 500,
        "Aug 2026 Paid On": "12/08/2026",
        "Aug 2026 Mode": "UPI",
        "Aug 2026 Receipt": receipt,
      }),
      // A second payment for August, on a row of its own.
      row({
        "Admission Number": number,
        "Aug 2026 Paid (₹)": 300,
        "Aug 2026 Paid On": "20/08/2026",
        "Aug 2026 Mode": "Cash",
      }),
    ]),
    "Students and Fees",
  );
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "students.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: write(filled, { type: "buffer", bookType: "xlsx" }),
  });

  await expect(dialog.getByText("Students to add")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("check.png") });
  await dialog
    .getByRole("button", { name: "Import 1 student and 1 bill" })
    .click();
  await expect(dialog.getByText("Students imported")).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();

  // The student is real, and what's left is collected like any other due.
  await page.goto(`/students?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("main").getByText(name)).toBeVisible();

  await page.goto("/fees");
  const search = page.getByPlaceholder(
    "Search student by name or roll number...",
  );
  await expect(search).toHaveCount(1);
  await search.fill(name);
  await page.getByRole("button", { name: new RegExp(name) }).click();
  const due = page.getByRole("button", { name: /^Pay Full Due/ });
  await expect(due).toBeVisible();
  await expect(due).toContainText("1,300");

  await page.goto(`/ledger?q=${receipt}`);
  const entry = page
    .getByRole("main")
    .getByRole("row")
    .filter({ hasText: receipt });
  await expect(entry).toContainText("12 Aug 2026");
  await expect(entry).toContainText(name);
});

test("a file with a student mistake is stopped, with nothing saved", async ({
  page,
}) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/students");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page
    .getByRole("button", { name: /^Import students with fee history/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Upload the filled file")).toBeVisible();

  const name = `Stopped Student ${uniqueId()}`;
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "students.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "Admission Number,Student Name,Class,Section,Parent Name,Parent Phone,Apr 2026 Tuition Fee (₹)",
        `X-${name},${name},Class 4,A,,9000000002,1000`,
      ].join("\n"),
    ),
  });

  await expect(dialog.getByRole("alert")).toContainText(
    "Row 2: Parent name is missing",
  );
  await expect(
    dialog.getByRole("button", {
      name: /^Import \d+ student|^Import \d+ bill/,
    }),
  ).toBeDisabled();

  await page.goto(`/students?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("main").getByText(name)).toHaveCount(0);
});
