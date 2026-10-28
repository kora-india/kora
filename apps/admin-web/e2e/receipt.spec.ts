import { SEEDED } from "./env";
import { expect, signIn, test } from "./helpers";

/** "Pay Full Due (₹4,500)" → 4500 */
const rupees = (text: string | null) =>
  Number((text ?? "").replace(/[^\d.]/g, "").replace(/^\./, ""));

/** Pages in a PDF made by Chromium. */
const pdfPages = (pdf: Buffer) =>
  (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

test("a fee taken at the desk prints a one-page receipt that matches it", async ({
  page,
  context,
}, testInfo) => {
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.goto("/fees");
  await page
    .getByPlaceholder("Search student by name or roll number...")
    .fill("Aman");
  await page.getByRole("button", { name: /Aman Kumar/ }).click();
  await expect(
    page.getByRole("heading", { name: "Aman Kumar", level: 2 }),
  ).toBeVisible();

  const fullDue = page.getByRole("button", { name: /^Pay Full Due/ });
  const owedBefore = rupees(await fullDue.textContent());
  expect(owedBefore).toBeGreaterThan(2000);

  // ₹2,000 towards the oldest months, then confirm and print.
  await page.getByPlaceholder("e.g. 6000").fill("2000");
  await page.getByRole("button", { name: "Allocate Oldest First" }).click();
  await page.getByRole("button", { name: "Preview Allocation" }).click();
  await page.getByRole("button", { name: "Confirm & Print Receipt" }).click();

  // The receipt is printed from a hidden frame; read what it sends to print.
  const frame = page.locator("#kora-receipt-print-frame");
  await frame.waitFor({ state: "attached" });
  const html = await frame.evaluate(
    (el) =>
      (el as HTMLIFrameElement).contentDocument!.documentElement.outerHTML,
  );
  const receiptNo = (
    await page
      .getByText(/^RCP-\d{4}-\d{5}$/)
      .first()
      .textContent()
  )?.trim();
  expect(receiptNo).toMatch(/^RCP-\d{4}-\d{5}$/);

  expect(html).toContain(receiptNo!);
  expect(html).toContain("Aman Kumar");
  expect(html).toContain(SEEDED.school);
  expect(html).toContain("₹2000.00");
  expect(html).not.toMatch(/NaN|undefined|Invalid Date|\[object Object\]/);
  if (owedBefore === 4500) {
    // Fresh seed: three months of ₹1,500. April clears, May has ₹1,000 left.
    expect(html).toContain("PARTIAL PAYMENT — ₹1000.00 DUE");
    expect(html).toContain("April 2026");
    expect(html).toContain("May 2026");
    expect(html).not.toContain("June 2026");
  }

  // As a printer sees it: one A4 page.
  const sheet = await context.newPage();
  await sheet.setContent(html, { waitUntil: "load" });
  await sheet.emulateMedia({ media: "print" });
  const pdf = await sheet.pdf({ format: "A4", printBackground: true });
  await testInfo.attach("receipt.pdf", {
    body: pdf,
    contentType: "application/pdf",
  });
  await sheet.screenshot({
    path: testInfo.outputPath("receipt.png"),
    fullPage: true,
  });
  expect(pdfPages(pdf), "the receipt fits on one page").toBe(1);
  await sheet.close();

  // Back on the screen, the family owes ₹2,000 less.
  await page.getByTitle("Close").first().click();
  await expect(fullDue).toHaveText(
    new RegExp(`₹${(owedBefore - 2000).toLocaleString("en-IN")}\\b`),
  );
});
