import fs from "node:fs";
import { read, utils, write } from "xlsx";
import { SEEDED } from "./env";
import { expect, signIn, test } from "./helpers";

const amount = (text: string | null) =>
  Number((text ?? "").replace(/[^\d.]/g, "").replace(/^\./, ""));

test("a school imports months of bills, late fees and payments, and can undo them", async ({
  page,
}, testInfo) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/fees");
  await page.getByRole("button", { name: "Import Fee History" }).click();
  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("From", { exact: true }).fill("2026-08");
  await dialog.getByLabel("To", { exact: true }).fill("2026-09");
  await page.screenshot({ path: testInfo.outputPath("start.png") });

  // The template has a row per student, with each month's fees filled in.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download Template" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("fee-history-template.xlsx");
  const book = read(fs.readFileSync(await download.path()));
  expect(book.SheetNames).toEqual(["Fee History", "Instructions"]);
  const rows = utils.sheet_to_json<(string | number)[]>(
    book.Sheets["Fee History"],
    { header: 1, defval: "" },
  );
  const headers = rows[0] as string[];
  const column = (name: string) => headers.indexOf(name);
  const pooja = rows.filter((r) => r[1] === "Pooja Kumari");
  expect(pooja).toHaveLength(1);
  const august = Number(pooja[0][column("Aug 2026 Fees (₹)")]);
  const september = Number(pooja[0][column("Sep 2026 Fees (₹)")]);
  expect(august).toBeGreaterThan(0);
  expect(september).toBeGreaterThan(0);

  // August was paid in full on a late date; September is unpaid with a fine.
  pooja[0][column("Aug 2026 Paid (₹)")] = august;
  pooja[0][column("Aug 2026 Paid On")] = "20/08/2026";
  pooja[0][column("Aug 2026 Mode")] = "UPI";
  pooja[0][column("Aug 2026 Receipt")] = "OLD-500";
  pooja[0][column("Aug 2026 Late Fee (₹)")] = 0;
  pooja[0][column("Sep 2026 Late Fee (₹)")] = 150;
  const filled = utils.book_new();
  utils.book_append_sheet(
    filled,
    utils.aoa_to_sheet([headers, ...pooja]),
    "Fee History",
  );
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "history.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: write(filled, { type: "buffer", bookType: "xlsx" }),
  });

  await expect(dialog.getByText("Still due")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("check.png") });
  await dialog.getByRole("button", { name: "Import 2 bills" }).click();
  await expect(dialog.getByText("Fee history imported")).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();

  // What's unpaid is collected at the desk, late fee included.
  await page.goto("/fees");
  const search = page.getByPlaceholder(
    "Search student by name or roll number...",
  );
  await expect(search).toHaveCount(1);
  await search.fill("Pooja");
  await page.getByRole("button", { name: /Pooja Kumari/ }).click();
  const due = page.getByRole("button", { name: /^Pay Full Due/ });
  await expect(due).toBeVisible();
  expect(amount(await due.textContent())).toBe(september + 150);

  // The old receipt is on the ledger, on its own date, marked as imported.
  await page.goto("/ledger?q=OLD-500");
  const main = page.getByRole("main");
  const row = main.getByRole("row").filter({ hasText: "OLD-500" });
  await expect(row).toContainText("20 Aug 2026");
  await expect(row).toContainText("Pooja Kumari");
  await expect(row).toContainText("Imported");

  await page.goto("/ledger?tab=activity");
  await expect(
    main.getByRole("button", { name: /^Imported fee history for 1 student/ }),
  ).toBeVisible();

  // Undone from the same dialog: the bills and the payment are gone.
  await page.goto("/fees");
  await page.getByRole("button", { name: "Import Fee History" }).click();
  await expect(dialog.getByText("2 bills")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("past-imports.png") });
  await dialog.getByRole("button", { name: /^Undo import of/ }).click();
  await page.getByRole("button", { name: "Undo Import" }).click();
  await expect(dialog.getByText("Undone")).toBeVisible();

  await page.goto("/ledger?q=OLD-500");
  await expect(main.getByText("Nothing here")).toBeVisible();
});

test("a file with a mistake is stopped, with nothing saved", async ({
  page,
}) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/fees");
  await page.getByRole("button", { name: "Import Fee History" }).click();
  const dialog = page.getByRole("dialog");

  await dialog.locator('input[type="file"]').setInputFiles({
    name: "history.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Admission Number,Apr 2026 Fees (₹),Apr 2026 Paid (₹)\nNOT-A-STUDENT,1000,\n",
    ),
  });

  await expect(dialog.getByRole("alert")).toContainText(
    "Row 2: Admission number NOT-A-STUDENT isn't a student at this school",
  );
  await expect(
    dialog.getByRole("button", { name: /^Import \d+ bill/ }),
  ).toBeDisabled();
});
