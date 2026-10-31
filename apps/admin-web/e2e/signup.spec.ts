import {
  expect,
  fillSchoolDetails,
  signUp,
  stubThirdParties,
  test,
  uniqueId,
} from "./helpers";

test("a new school signs up, sets up and lands on its dashboard", async ({
  page,
}, testInfo) => {
  await stubThirdParties(page);
  const id = uniqueId();
  const schoolName = `Sunrise School ${id}`;

  await signUp(page, {
    name: "Asha Rao",
    email: `asha.${id}@example.com`,
    password: "sunrise-password",
  });
  await fillSchoolDetails(page, schoolName);
  await page.getByRole("button", { name: "Start 14-day free trial" }).click();

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Asha");
  // Within main: while the page streams in, a hidden copy can sit elsewhere.
  await expect(
    page.getByRole("main").getByText(`${schoolName} ·`),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Free trial · \d+d left/ }),
  ).toBeVisible();

  // Onboarding ends by asking how to bring the students in.
  const panel = page.getByRole("region", { name: "Add your students" });
  await expect(panel.getByText("6 fee heads")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: /^Import students only/ }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: /^Import students with fee history/ }),
  ).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("add-students.png") });

  // Skipped, the same choice waits on the Students page.
  await panel.getByRole("button", { name: /^Skip for now/ }).click();
  await expect(panel).toHaveCount(0);
  await page.goto("/students");
  await expect(
    page
      .getByRole("main")
      .getByRole("button", { name: /^Import students with fee history/ }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("no-students.png") });
});
