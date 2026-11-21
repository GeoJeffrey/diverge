import { expect, test } from "@playwright/test";

/**
 * The HTML-first shell (prerender-shell.ts) must (1) paint each page's headline before any
 * JavaScript runs and (2) match React's first render so closely that mounting the app moves
 * nothing. If a component changes and the shell isn't updated, (2) fails.
 */
const PAGES = [
  { path: "/", heading: "Tomorrow, read from today's chatter." },
  { path: "/market", heading: "Market" },
  { path: "/model", heading: "Checked against days it had never seen." },
  { path: "/method", heading: "How Diverge turns chatter into a call." },
];

for (const width of [375, 1280]) {
  test.describe(`shell at ${width}px`, () => {
    test.use({ viewport: { width, height: width === 375 ? 812 : 800 } });

    for (const pg of PAGES) {
      test(`${pg.path} paints its headline before the app bundle runs`, async ({ page }) => {
        // Block the app's JS bundles; only index.html and its tiny inline scripts run.
        await page.route("**/assets/*.js", (route) => route.abort());
        await page.goto(pg.path);
        await expect(page.getByRole("heading", { level: 1, name: pg.heading })).toBeVisible();
      });

      test(`${pg.path} mounts without layout shift`, async ({ page }) => {
        await page.addInitScript(() => {
          (window as unknown as { __cls: number }).__cls = 0;
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
              if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
            }
          }).observe({ type: "layout-shift", buffered: true });
        });
        await page.goto(pg.path);
        await expect(page.getByRole("heading", { level: 1, name: pg.heading })).toBeVisible();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1500);
        const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
        expect(cls, `cumulative layout shift on ${pg.path}`).toBeLessThan(0.01);
      });
    }
  });
}
