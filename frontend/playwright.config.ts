import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests against a production build in demo (mock) mode.
 * Locally: PW_CHANNEL=msedge uses the installed Edge (no browser download). CI uses Playwright's Chromium.
 */
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    reducedMotion: "reduce",
    ...devices["Desktop Chrome"],
    channel,
  },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_API_BASE_URL: "mock" },
  },
});
