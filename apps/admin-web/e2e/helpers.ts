import { expect, type Page } from "@playwright/test";
import { MAILBOX_URL } from "./env";

/** Different on every attempt, so a retry never collides with its first try. */
export const uniqueId = () =>
  Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);

/** Answers the third-party calls the browser makes, which tests don't check. */
export async function stubThirdParties(page: Page) {
  await page.route("https://checkout.razorpay.com/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "" }),
  );
  await page.route("https://api.postalpincode.in/**", (route) =>
    route.fulfill({
      json: [
        {
          Status: "Success",
          PostOffice: [
            { District: "Ranchi", State: "Jharkhand", Country: "India" },
          ],
        },
      ],
    }),
  );
}

/** The 6-digit sign-up code last emailed to `email`, from the mail catcher. */
export async function emailedCode(email: string) {
  let code = "";
  await expect
    .poll(
      async () => {
        const res = await fetch(
          `${MAILBOX_URL}/messages?to=${encodeURIComponent(email)}`,
        );
        const messages: { html: string }[] = await res.json();
        code = messages.at(-1)?.html.match(/>(\d{6})</)?.[1] ?? "";
        return code;
      },
      { message: `a sign-up code emailed to ${email}` },
    )
    .not.toBe("");
  return code;
}

export interface Account {
  name: string;
  email: string;
  password: string;
}

/** Registers with the emailed code and lands on the setup wizard. */
export async function signUp(page: Page, account: Account) {
  await page.goto("/register");
  await page.getByPlaceholder("John Doe").fill(account.name);
  await page.getByPlaceholder("admin@school.edu.in").fill(account.email);
  await page.getByPlaceholder("••••••••").fill(account.password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByText("Check your email")).toBeVisible();
  await page.getByPlaceholder("000000").fill(await emailedCode(account.email));
  await page.getByRole("button", { name: "Verify & Create Account" }).click();
  await expect(page).toHaveURL(/\/setup$/);
}

/**
 * The whole run shares one login limit: 15 attempts from this machine per 15
 * minutes (packages/auth), failed ones included. Each test that signs in
 * uses one.
 */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("admin@school.edu.in").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Fills the wizard's first three steps and stops on the plan step. */
export async function fillSchoolDetails(page: Page, schoolName: string) {
  const heading = page.getByRole("heading", { level: 1 });
  const next = page.getByRole("button", { name: "Continue", exact: true });

  await expect(heading).toHaveText("Tell us about your school");
  await page.getByLabel("School name", { exact: true }).fill(schoolName);
  await page.getByLabel("Number of students", { exact: true }).fill("400");
  await page.getByLabel("Number of staff", { exact: true }).fill("25");
  await expect(page.getByText(/\.schoolos\.com is available/)).toBeVisible();
  await next.click();

  await expect(heading).toHaveText("Where is your school?");
  await page
    .getByLabel("Street address", { exact: true })
    .fill("12, Station Road");
  await page.getByLabel("Pincode", { exact: true }).fill("834001");
  await expect(page.getByText("Filled in Ranchi, Jharkhand")).toBeVisible();
  await page.getByLabel("Office phone", { exact: true }).fill("9876543210");
  await next.click();

  await expect(heading).toHaveText("How does your school run?");
  await page
    .getByRole("button", { name: "Select all Primary classes" })
    .click();
  await next.click();

  await expect(heading).toHaveText("Review and choose how to start");
}
