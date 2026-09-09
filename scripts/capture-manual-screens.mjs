// Regenerates the screenshots referenced by the in-app user manual
// (app/(backend)/manual/manual-content.ts) into public/manual/screens/.
//
// Requires the dev server already running on http://localhost:3000 (this
// project never starts/stops it — see CLAUDE.md / playwright.config.ts) and
// the seeded demo accounts (admin@demo.com / supervisor@demo.com /
// user1@demo.com, password P@ssw0rd).
//
// Run: npm run manual:screens
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const rootDir = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const outDir = path.join(rootDir, "public/manual/screens");
const BASE_URL = process.env.MANUAL_BASE_URL ?? "http://localhost:3000";
const PASSWORD = "P@ssw0rd";
const VIEWPORT = { width: 1440, height: 900 };

/**
 * @typedef {object} Shot
 * @property {string} name
 * @property {string} [goto]      path to navigate to first
 * @property {(page: import('@playwright/test').Page) => Promise<void>} [action]  optional best-effort setup (open a modal, drill into a row)
 */

async function login(page, email) {
  await page.goto(`${BASE_URL}/login`);
  await page.locator("#loginEmail").fill(email);
  await page.locator("#loginPassword").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

async function logout(page) {
  await page.locator(".user-menu .dropdown-toggle").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/login"), { timeout: 30_000 });
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
}

// Hide the Next.js dev-mode indicator so it doesn't show up in the manual.
const HIDE_DEV_UI = `
  nextjs-portal, [data-nextjs-toast], #__next-build-watcher,
  [data-next-badge-root], [data-next-badge] { display: none !important; }
`;

async function shoot(page, name) {
  await settle(page);
  await page.addStyleTag({ content: HIDE_DEV_UI }).catch(() => {});
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  console.log(`  ✓ ${name}.png`);
}

/** Click the first data-row link in a list page and wait for navigation. */
async function openFirstRow(page) {
  const link = page.locator("table tbody tr a, .list-card tbody tr a").first();
  await link.click({ timeout: 5000 });
  await page.waitForLoadState("domcontentloaded");
}

/** Open the ⋮ row menu on the first Ticket Management row, then "Assign". */
async function openAssignModal(page) {
  await page.locator("table tbody tr .dropdown-toggle, table tbody tr [data-bs-toggle='dropdown']").first().click({ timeout: 4000 });
  await page.getByRole("button", { name: "Assign", exact: true }).click({ timeout: 4000 });
  await page.locator(".modal.show").waitFor({ timeout: 4000 });
}

/** From an approval request page, open the approve/reject decision modal. */
async function openDecisionModal(page) {
  await openFirstRow(page);
  await page.getByRole("button", { name: /approve|reject|decide|decision/i }).first().click({ timeout: 4000 });
  await page.locator(".modal.show").waitFor({ timeout: 4000 });
}

/** @param {import('@playwright/test').Page} page @param {Shot[]} shots */
async function capture(page, shots) {
  for (const shot of shots) {
    try {
      if (shot.goto) await page.goto(`${BASE_URL}${shot.goto}`);
      await settle(page);
      if (shot.action) {
        try {
          await shot.action(page);
          await page.waitForTimeout(500);
        } catch {
          console.log(`  · ${shot.name}: setup step skipped, captured plain page`);
        }
      }
      await shoot(page, shot.name);
    } catch (err) {
      console.warn(`  ✗ ${shot.name}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

async function run() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/login`);
    await shoot(page, "login");

    await login(page, "user1@demo.com");
    await capture(page, [
      { name: "user-tickets", goto: "/tickets" },
      { name: "user-new-ticket", goto: "/tickets/new" },
      { name: "user-notifications", goto: "/notifications" },
      { name: "user-profile", goto: "/profile" },
      { name: "user-lesson-learned", goto: "/lesson-learned" },
      { name: "user-ticket-detail", goto: "/tickets", action: openFirstRow },
    ]);
    await logout(page);

    await login(page, "supervisor@demo.com");
    await capture(page, [
      { name: "approver-approval-queue", goto: "/tickets/approval" },
      { name: "approver-assigned", goto: "/tickets/assigned" },
      { name: "approver-decide", goto: "/tickets/approval", action: openDecisionModal },
    ]);
    await logout(page);

    await login(page, "admin@demo.com");
    await capture(page, [
      { name: "admin-dashboard", goto: "/dashboard" },
      { name: "admin-ticket-management", goto: "/transaction/ticket-management" },
      { name: "admin-assign", goto: "/transaction/ticket-management", action: openAssignModal },
      { name: "admin-master-users", goto: "/master/user" },
      { name: "admin-master-user-groups", goto: "/master/user-group" },
      { name: "admin-master-categories", goto: "/master/category" },
      { name: "admin-master-companies", goto: "/master/company" },
      { name: "admin-master-lessons", goto: "/master/lesson-learned" },
      { name: "admin-reports", goto: "/transaction/report" },
      { name: "admin-logs", goto: "/logs" },
    ]);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
