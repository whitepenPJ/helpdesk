import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const PASSWORD = "P@ssw0rd";
const USER_EMAIL = "user1@demo.com";
const ADMIN_EMAIL = "admin@demo.com";
const ASSIGNEE_EMAIL = "supervisor@demo.com";

// Query the seeded demo data directly rather than hardcoding names — this
// app's category/company/department names (and the assignee's display
// name) aren't guaranteed stable across reseeds.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("#loginEmail").fill(email);
  await page.locator("#loginPassword").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function logout(page: Page) {
  // "Sign out" lives inside a collapsed Bootstrap dropdown in the header —
  // has to be opened first.
  await page.locator(".user-menu .dropdown-toggle").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/login"));
}

// Select2 (v4) replaces the real `<select id="X">` with a widget whose
// clickable combobox trigger carries `aria-labelledby="select2-X-container"`.
// Click it, type into the search box Select2 injects, then click the match.
async function selectSelect2Option(page: Page, selectId: string, optionLabel: string) {
  await page.locator(`[aria-labelledby="select2-${selectId}-container"]`).click();
  await page.locator("input.select2-search__field").fill(optionLabel);
  await page.locator("li.select2-results__option", { hasText: optionLabel }).first().click();
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("full ticket lifecycle happy path: create → assign → resolve → verify → close & rate", async ({ page }) => {
  const [category, company, assignee] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true }, select: { name: true } }),
    prisma.company.findFirstOrThrow({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.user.findUniqueOrThrow({ where: { email: ASSIGNEE_EMAIL }, select: { name: true } }),
  ]);
  const department = await prisma.department.findFirstOrThrow({
    where: { companyId: company.id },
    select: { name: true },
  });

  const ticketTitle = `Playwright happy path ${Date.now()}`;
  let ticketPath = "";

  await test.step("1. Login as user", async () => {
    await login(page, USER_EMAIL);
  });

  await test.step("2. Create ticket", async () => {
    await page.goto("/tickets/new");
    await page.locator("#title").fill(ticketTitle);
    await page.locator("#description").fill("Automated end-to-end happy-path test ticket.");
    await selectSelect2Option(page, "categoryId", category.name);
    await page.locator("#telephone").fill("0812345678");
    await selectSelect2Option(page, "companyId", company.name);
    await expect(page.locator("#departmentId")).toBeEnabled();
    await selectSelect2Option(page, "departmentId", department.name);
    await page.getByRole("button", { name: "Submit ticket" }).click();

    // Ticket ids are randomUUID() — matched specifically so this doesn't
    // false-positive-resolve against the pre-submit "/tickets/new" URL
    // itself (which also matches a looser "/tickets/<anything>" pattern).
    await page.waitForURL(/\/tickets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    ticketPath = new URL(page.url()).pathname;
    await expect(page.locator(".card-title", { hasText: ticketTitle })).toBeVisible();
  });

  await test.step("3. Logout, login as admin", async () => {
    await logout(page);
    await login(page, ADMIN_EMAIL);
  });

  await test.step("4. Assign to assignee", async () => {
    await page.goto(`${ticketPath}?edit=1`);
    await page.locator("#edit-assignee").selectOption({ label: assignee.name });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".badge", { hasText: "ASSIGNED" })).toBeVisible();
  });

  await test.step("5. Login as assignee", async () => {
    await logout(page);
    await login(page, ASSIGNEE_EMAIL);
  });

  await test.step("6. Mark as resolved", async () => {
    await page.goto(ticketPath);
    await page.getByRole("button", { name: "Mark Resolved" }).click();
    await expect(page.locator(".badge", { hasText: "RESOLVED" })).toBeVisible();
  });

  await test.step("7. Login as user, close and rate the service", async () => {
    await logout(page);
    await login(page, USER_EMAIL);
    await page.goto(ticketPath);
    await page.getByRole("button", { name: "Close Ticket" }).click();
    await page.getByRole("button", { name: "Very Satisfied" }).click();
    await page.getByRole("button", { name: "Submit & Close" }).click();
    await expect(page.locator(".badge", { hasText: "CLOSED" })).toBeVisible();
  });
});
