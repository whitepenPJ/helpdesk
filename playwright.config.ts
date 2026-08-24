import { defineConfig, devices } from "@playwright/test";

// Points at the persistently-running `npm run dev` server (see CLAUDE.md) —
// deliberately no `webServer` block here, since this project's dev server
// is expected to already be running and shouldn't be started/stopped by
// the test run.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
