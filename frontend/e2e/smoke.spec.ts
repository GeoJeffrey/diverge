import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const ROUTES: { path: string; name: string; auth?: boolean }[] = [
  { path: "/", name: "landing" },
  { path: "/market", name: "market" },
  { path: "/ticker/RELIANCE", name: "ticker-simple" },
  { path: "/ticker/SBIN", name: "ticker-no-call" },
  { path: "/ticker/HDFCBANK/advanced", name: "ticker-advanced", auth: true },
  { path: "/ticker/HDFCBANK/why", name: "why-this-score", auth: true },
  { path: "/ticker/HDFCBANK/integrity", name: "integrity", auth: true },
  { path: "/model", name: "model-accuracy" },
  { path: "/method", name: "method" },
  { path: "/login", name: "login" },
  { path: "/signup", name: "signup" },
  { path: "/settings", name: "settings", auth: true },
  { path: "/no-such-page", name: "not-found" },
];

const THEMES = ["ink", "paper"] as const;
const WIDTHS = [375, 1280] as const;
const OUT = "screenshots/e2e";
mkdirSync(OUT, { recursive: true });

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("trader@example.com");
  await page.getByLabel("Password").fill("SecurePass123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/market");
}

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test.describe(`${theme} ${width}px`, () => {
      test.use({ viewport: { width, height: width === 375 ? 812 : 800 }, colorScheme: theme === "paper" ? "light" : "dark" });

      for (const r of ROUTES) {
        test(`${r.name} renders, has no console errors and no axe violations`, async ({ page }) => {
          const errors: string[] = [];
          page.on("pageerror", (e) => errors.push(e.message));
          page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
          await page.addInitScript((t) => localStorage.setItem("diverge.theme", t), theme);
          if (r.auth) await signIn(page);
          await page.goto(r.path);
          await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
          await expect(page.getByText("Demo data.")).toBeVisible();
          await page.waitForLoadState("networkidle");

          const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          const violations = axe.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) e.g. ${v.nodes[0]?.target.join(" ")}`);
          if (violations.length) writeFileSync(`${OUT}/${r.name}_${theme}_${width}.axe.txt`, violations.join("\n"));

          await page.screenshot({ path: `${OUT}/${r.name}_${theme}_${width}.png`, fullPage: true });
          expect(violations, "axe WCAG 2.1 AA violations").toEqual([]);
          expect(errors, "console/page errors").toEqual([]);
        });
      }
    });
  }
}

test("keyboard: skip link moves focus to the main content", async ({ page }) => {
  await page.goto("/market");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // app mounted
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("theme toggle flips the theme and remembers it", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("button", { name: /Switch to light theme/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
});
