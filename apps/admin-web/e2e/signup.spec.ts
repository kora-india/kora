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
}) => {
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
});
