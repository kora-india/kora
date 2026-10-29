import { SEEDED } from "./env";
import { expect, signIn, test } from "./helpers";

const csv = (lines: string[]) => ({
  name: "students.csv",
  mimeType: "text/csv",
  buffer: Buffer.from(lines.join("\n")),
});

test("a sheet headed the way a school writes it imports, row problems named", async ({
  page,
}) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/students");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      csv([
        "Full Name,Admission Number,Roll Number,Class,Section,Gender,Blood Group,Date of Birth,Parent / Guardian Name,Parent Phone,Parent Email,Religion",
        "Import Tanvi,IMP-0001,41,Class 4,A,Female,A-,24/11/2015,Myra Prasad,9416940224,parent1@example.com,Hindu",
        "Import Anika,IMP-0002,042,Class 4,A,Female,,,Neha Yadav,9158116441,,Hindu",
        "Import Yash,IMP-0003,42,Class 4,A,Male,O+,22/12/2016,Kavya Malhotra,9434671635,,Hindu",
        "Import Kavya,IMP-0004,43,Class 4,A,Male,,,,9262325457,,Hindu",
      ]),
    );

  const dialog = page
    .locator("div.fixed")
    .filter({ hasText: "Bulk Import Students" });
  await expect(dialog.getByText("Preview Data (4 records)")).toBeVisible();
  await expect(dialog.getByText("Not imported: Religion")).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(dialog.getByRole("cell", { name: "Myra Prasad" })).toBeVisible();

  await dialog.getByRole("button", { name: "Start Import" }).click();
  await expect(dialog.getByText("Import Complete")).toBeVisible();
  // Roll 042 and roll 42 are the same roll; Kavya has no parent name.
  await expect(
    dialog.getByText("Row 4: Skipped, roll number 42"),
  ).toBeVisible();
  await expect(dialog.getByText("Row 5: Parent name is missing")).toBeVisible();

  await page.goto("/students?q=Import%20Tanvi");
  await expect(page.getByRole("main").getByText("Import Tanvi")).toBeVisible();
});

test("a sheet missing a required column is stopped before importing", async ({
  page,
}) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/students");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      csv(["Kid,Class,Section,Mobile", "Asha,Class 4,A,9000000000"]),
    );

  const dialog = page
    .locator("div.fixed")
    .filter({ hasText: "Bulk Import Students" });
  await expect(dialog.getByRole("alert")).toContainText(
    "Couldn't find a column for student name, parent name",
  );
  await expect(dialog.getByRole("alert")).toContainText(
    "weren't recognised: Kid",
  );
  await expect(
    dialog.getByRole("button", { name: "Start Import" }),
  ).toBeDisabled();
});
