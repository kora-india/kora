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
  await expect(dialog.getByLabel('Field for column "Full Name"')).toHaveValue(
    "name",
  );
  await expect(
    dialog.getByLabel('Field for column "Parent / Guardian Name"'),
  ).toHaveValue("parentName");
  // Not a student field, so it isn't imported.
  await expect(dialog.getByLabel('Field for column "Religion"')).toHaveValue(
    "",
  );
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

test("columns it can't read are matched by hand before importing", async ({
  page,
}) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/students");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      csv([
        "Kid,Class,Section,Mobile,Ma Baap",
        "Hand Matched Asha,Class 4,A,9000000000,Ravi Verma",
      ]),
    );

  const dialog = page
    .locator("div.fixed")
    .filter({ hasText: "Bulk Import Students" });
  // No Gemini key on the test server, so nothing is suggested.
  await expect(dialog.getByRole("alert")).toContainText(
    "Choose a column for student name, parent name",
  );
  const start = dialog.getByRole("button", { name: "Start Import" });
  await expect(start).toBeDisabled();

  await dialog
    .getByLabel('Field for column "Kid"')
    .selectOption({ label: "Student name" });
  await dialog
    .getByLabel('Field for column "Ma Baap"')
    .selectOption({ label: "Parent name" });
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(
    dialog.getByRole("cell", { name: "Hand Matched Asha" }),
  ).toBeVisible();

  await start.click();
  await expect(dialog.getByText("Import Complete")).toBeVisible();
  await expect(dialog.locator("p.text-3xl").first()).toHaveText("1");
});
