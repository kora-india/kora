import { SEEDED } from "./env";
import { expect, signIn, test } from "./helpers";

test("a long student list pages, and the page size can change", async ({
  page,
}, testInfo) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);

  // Enough students for more than one page of 20.
  await page.goto("/students");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "students.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "Student Name,Class,Section,Roll Number,Parent Name,Parent Phone",
        ...Array.from(
          { length: 25 },
          (_, i) =>
            `Paging Student ${i + 1},Class 4,A,${201 + i},Parent ${i + 1},90000000${String(i).padStart(2, "0")}`,
        ),
      ].join("\n"),
    ),
  });
  await page.getByRole("button", { name: "Start Import" }).click();
  await expect(page.getByText("Import Complete")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  const main = page.getByRole("main");
  const pager = main.locator(".ant-pagination");
  await expect(pager).toContainText(/^1–20 of \d+ students/);
  const total = Number(
    (await pager.locator(".ant-pagination-total-text").textContent())!.match(
      /of (\d+)/,
    )![1],
  );
  expect(total).toBeGreaterThan(20);
  await expect(main.locator("tbody tr")).toHaveCount(20);
  // Page numbers are condensed, not one button per page.
  expect(
    await pager.locator(".ant-pagination-item").count(),
  ).toBeLessThanOrEqual(7);
  await pager.screenshot({ path: testInfo.outputPath("pager.png") });

  await pager.getByTitle("2", { exact: true }).click();
  await expect(pager).toContainText(`21–${Math.min(40, total)} of ${total}`);

  // A bigger page starts again from the first page.
  await pager.locator(".ant-select").click();
  await page.getByTitle("50 / page").click();
  await expect(pager).toContainText(
    `1–${Math.min(50, total)} of ${total} students`,
  );
  await expect(main.locator("tbody tr")).toHaveCount(Math.min(50, total));

  await page.emulateMedia({ colorScheme: "dark" });
  await pager.screenshot({ path: testInfo.outputPath("pager-dark.png") });
});
