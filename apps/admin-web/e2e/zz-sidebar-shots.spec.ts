import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { SEEDED, SUPER_ADMIN } from "./env";
import { signIn, test } from "./helpers";

// Temporary: renders and measures the sidebar. Not part of the suite.
const OUT = process.env.SHOTS_DIR!;
const metricsFile = path.join(OUT, "metrics.json");

const record = (key: string, value: unknown) => {
  const metrics = fs.existsSync(metricsFile)
    ? JSON.parse(fs.readFileSync(metricsFile, "utf8"))
    : {};
  metrics[key] = value;
  fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kora_tour_completed__dashboard", "true");
  });
});

// Scrolled part way, nothing may show under the pinned row.
const pinnedGap = (page: Page) =>
  page.evaluate(() => {
    const nav = document.querySelector("#tour-sidebar-nav") as HTMLElement;
    nav.scrollTo(0, 20);
    const pinned = document.querySelector("#tour-nav-settings")
      ?.parentElement as HTMLElement;
    return (
      nav.getBoundingClientRect().bottom - pinned.getBoundingClientRect().bottom
    );
  });

const menu = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll("#tour-sidebar-nav [role=group]")).map(
      (group) => ({
        section: group.getAttribute("aria-label"),
        links: Array.from(group.querySelectorAll("a")).map((a) =>
          a.textContent?.trim(),
        ),
      }),
    ),
  );

const navBox = (page: Page) =>
  page.evaluate(() => {
    const nav = document.querySelector("#tour-sidebar-nav") as HTMLElement;
    const aside = document.querySelector("#app-sidebar") as HTMLElement;
    return {
      scrollHeight: nav.scrollHeight,
      clientHeight: nav.clientHeight,
      overflowY: nav.scrollHeight - nav.clientHeight,
      overflowX: aside.scrollWidth - aside.clientWidth,
      rowHeight: (nav.querySelector("a") as HTMLElement).offsetHeight,
    };
  });

const rowTops = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      Array.from(document.querySelectorAll("#tour-sidebar-nav a")).map((a) => [
        a.getAttribute("href"),
        Math.round(a.getBoundingClientRect().top),
      ]),
    ),
  );

const shot = (page: Page, name: string) =>
  page.locator("#app-sidebar").screenshot({ path: `${OUT}/${name}.png` });

const accounts = [
  ["admin", SEEDED.schoolAdmin],
  ["teacher", SEEDED.teacher],
  ["super", SUPER_ADMIN],
] as const;

for (const [name, account] of accounts) {
  test(`renders for ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await signIn(page, account.email, account.password);
    await page.waitForTimeout(1000);
    await page.keyboard.press("Escape");
    record(`${name}.menu`, await menu(page));
    record(`${name}.1920x1000`, await navBox(page));
    await shot(page, `${name}-desktop`);
    await page.screenshot({ path: `${OUT}/${name}-page.png` });

    const before = await rowTops(page);
    await page.getByRole("button", { name: "Collapse" }).click();
    await page.waitForTimeout(400);
    const after = await rowTops(page);
    record(
      `${name}.rowsMovedOnCollapse`,
      Object.keys(before).filter((href) => before[href] !== after[href]),
    );
    await shot(page, `${name}-rail`);
  });
}

test("the admin menu on short screens, in dark mode and on phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 790 });
  await signIn(page, SEEDED.schoolAdmin.email, SEEDED.schoolAdmin.password);
  await page.waitForTimeout(1000);
  await page.keyboard.press("Escape");
  await page.goto("/fees");
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  record("admin.1440x790", await navBox(page));
  await shot(page, "admin-laptop");
  record("admin.pinnedGapDesktop", await pinnedGap(page));

  const settings = page.locator("#tour-nav-settings");
  const notices = page.locator("#tour-nav-notices");

  // Pinned while the rest scrolls.
  const navBottom = () =>
    page
      .locator("#tour-sidebar-nav")
      .evaluate((nav) => Math.round(nav.getBoundingClientRect().bottom));
  const atTop = await settings.boundingBox();
  await page
    .locator("#tour-sidebar-nav")
    .evaluate((nav) => nav.scrollTo(0, nav.scrollHeight));
  await page.waitForTimeout(100);
  const atEnd = await settings.boundingBox();
  const lastRow = await notices.boundingBox();
  record("admin.settingsPinned", {
    settingsTopBeforeScroll: atTop?.y,
    settingsTopAfterScroll: atEnd?.y,
    navBottom: await navBottom(),
    noticesBottomAtScrollEnd: (lastRow?.y ?? 0) + (lastRow?.height ?? 0),
  });
  await shot(page, "admin-laptop-scrolled");

  // Focus scrolled into view must not end up behind the pinned row.
  await page.locator("#tour-sidebar-nav").evaluate((nav) => nav.scrollTo(0, 0));
  await page.locator("#tour-nav-transport").focus();
  await page.waitForTimeout(100);
  const focused = await page.locator("#tour-nav-transport").boundingBox();
  const pinned = await settings.boundingBox();
  record("admin.focusClearOfPinnedRow", {
    focusedBottom: (focused?.y ?? 0) + (focused?.height ?? 0),
    pinnedRowTop: pinned?.y,
  });

  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(200);
  await shot(page, "admin-dark");
  await page.evaluate(() => document.documentElement.classList.remove("dark"));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.locator('button[aria-controls="app-sidebar"]').click();
  await page.waitForTimeout(500);
  record("admin.390x844", await navBox(page));
  record("admin.pinnedGapPhone", await pinnedGap(page));
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${OUT}/admin-phone.png` });
});
