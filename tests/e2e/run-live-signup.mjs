/* eslint-disable no-console */
/**
 * Signup path against the live Supabase project.
 *
 * The live project requires email confirmation, so this checks that the web
 * app shows the "check your inbox" state, then confirms the account and
 * finishes the journey with a working vault.
 */
import { chromium } from "playwright-core";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = process.env.QA_APP_URL || "http://localhost:3000";
const EMAIL = process.env.QA_SIGNUP_EMAIL;
const PASSWORD = process.env.QA_PASSWORD;
const MASTER = process.env.QA_MASTER;

function resolveBrowser() {
  const bundled = chromium.executablePath();
  if (bundled && existsSync(bundled)) return { executablePath: bundled };
  const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
  const build = readdirSync(cache).filter((n) => n.startsWith("chromium-")).sort().pop();
  const candidate = path.join(cache, build, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
  if (existsSync(candidate)) return { executablePath: candidate };
  return { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" };
}

const failures = [];
function check(name, condition, extra = "") {
  if (condition) console.log(`  PASS  ${name}`);
  else {
    failures.push(name);
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

if (!EMAIL || !PASSWORD || !MASTER) {
  console.error("Set QA_SIGNUP_EMAIL, QA_PASSWORD and QA_MASTER.");
  process.exit(1);
}

const browser = await chromium.launch({ ...resolveBrowser(), headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const bodyText = async () => page.locator("body").first().innerText().catch(() => "");
const has = async (s) => (await page.locator(s).count()) > 0;

// 1. Sign up through the UI
await page.goto(`${APP}/signup`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const passwordFields = page.locator('input[type="password"]');
await page.fill('input[type="email"]', EMAIL);
await passwordFields.nth(0).fill(PASSWORD);
if ((await passwordFields.count()) > 1) await passwordFields.nth(1).fill(PASSWORD);
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(4000);
const afterSignup = await bodyText();
check(
  "signup shows the email-confirmation state",
  /confirmation link|inbox|confirm/i.test(afterSignup),
  afterSignup.slice(0, 200),
);
console.log(`        ${afterSignup.split("\n").slice(0, 3).join(" | ")}`);

// 2. Confirm the account (stands in for clicking the emailed link)
const confirmed = await fetch(`${process.env.QA_SUPABASE_URL}/auth/v1/admin/users`, {
  method: "GET",
  headers: {
    apikey: process.env.QA_SERVICE_KEY,
    Authorization: `Bearer ${process.env.QA_SERVICE_KEY}`,
  },
});
const list = await confirmed.json();
const user = (list.users ?? []).find((entry) => entry.email === EMAIL);
check("the account was created on the live project", Boolean(user), JSON.stringify(list).slice(0, 160));

if (user) {
  await fetch(`${process.env.QA_SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    headers: {
      apikey: process.env.QA_SERVICE_KEY,
      Authorization: `Bearer ${process.env.QA_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email_confirm: true }),
  });
}

// 3. Sign in and finish the journey
await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(3500);
check("signed in after confirming", !page.url().includes("/login"), page.url());

await page.waitForSelector("#confirm-password", { timeout: 20000 }).catch(() => {});
if (await has("#confirm-password")) {
  await page.fill("#master-password", MASTER);
  await page.fill("#confirm-password", MASTER);
  await page.locator('input[type="checkbox"]').first().check();
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForTimeout(4000);
  const panel = await bodyText();
  check("vault was created for the new account", /recovery key|open my vault/i.test(panel), panel.slice(0, 160));
  const ack = page.locator('input[type="checkbox"]').last();
  if (await ack.count()) await ack.check();
  const done = page.getByRole("button", { name: /open my vault/i });
  if (await done.count()) await done.first().click();
  await page.waitForTimeout(2500);
} else {
  check("vault was created for the new account", false, "setup screen not shown");
}

// 4. Add a credential to prove the new account is fully functional
await page.goto(`${APP}/app/credentials/new`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
if (await has("#master-password")) {
  await page.fill("#master-password", MASTER);
  await page.waitForTimeout(400);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
}
await page.waitForSelector("#application-name", { timeout: 20000 }).catch(() => {});
if (await has("#application-name")) {
  await page.fill("#application-name", "Signup Probe");
  await page.fill("#website-url", "https://example.org/signup");
  await page.fill("#username", "signup.probe");
  await page.fill("#credential-password", "S1gnup-QA-Pass!");
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(/\/app\/credentials\/[0-9a-f-]{36}/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  check("credential saved for the new account", /\/app\/credentials\/[0-9a-f-]{36}/.test(page.url()), page.url());
} else {
  check("credential saved for the new account", false, "form not shown");
}

check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("\nAll live signup checks passed.");
}
