import { SEEDED } from "./env";
import { expect, lastEmail, signIn, test } from "./helpers";

test("a forgotten password is reset from the emailed link", async ({
  page,
}) => {
  const { email, password } = SEEDED.teacher;
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByText("Check your email")).toBeVisible();
  // Another link has to wait a minute.
  const resend = page.getByRole("button", { name: /^Resend link in \d+s$/ });
  await expect(resend).toBeDisabled();
  await page.getByRole("button", { name: "Use a different email" }).click();
  await expect(
    page.getByRole("button", { name: /^Send another link in \d+s$/ }),
  ).toBeDisabled();

  const mail = await lastEmail(email, /^Reset your Kora password$/);
  const link = mail.html.match(
    /href="([^"]+reset-password\?token=[^"]+)"/,
  )?.[1];
  expect(link).toBeTruthy();

  await page.goto(new URL(link!).pathname + new URL(link!).search);
  // The same password again, so the shared test account stays as it was.
  await page.getByLabel("New Password").fill(password);
  await page.getByLabel("Confirm Password").fill(password);
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page, email, password);
});
