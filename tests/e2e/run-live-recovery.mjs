/* eslint-disable no-console */
/**
 * Recovery-key flow against the live Supabase project:
 * create a vault for a fresh account, capture the one-time recovery key,
 * add a credential, then reset the master password with the recovery key and
 * confirm the vault still opens and decrypts.
 */
import { chromium } from "playwright-core";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = "http://localhost:3000";
const EMAIL = process.env.QA_EMAIL;
const PASSWORD = process.env.QA_PASSWORD;
const MASTER = process.env.QA_MASTER;
const NEW_MASTER = process.env.QA_NEW_MASTER;

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

if (!EMAIL || !PASSWORD || !MASTER || !NEW_MASTER) {
  console.error("Set QA_EMAIL, QA_PASSWORD, QA_MASTER and QA_NEW_MASTER to run the live recovery test.");
  process.exit(1);
}

const browser = await chromium.launch({ ...resolveBrowser(), headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const has = async (s) => (await page.locator(s).count()) > 0;
const bodyText = async () => page.locator("body").first().innerText().catch(() => "");
const submit = () => page.locator('form button[type="submit"]').first().click();

// 1. Sign in
await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
check("signed in", !page.url().includes("/login"), page.url());

// 2. Create the vault and capture the recovery key
await page.waitForSelector("#confirm-password", { timeout: 20000 });
await page.fill("#master-password", MASTER);
await page.fill("#confirm-password", MASTER);
await page.locator('input[type="checkbox"]').first().check();
await submit();
await page.waitForTimeout(4000);
const panel = await bodyText();
const recoveryKey = (panel.match(/[0-9A-Z]{4}(?:-[0-9A-Z]{4}){7}/) || [])[0] || null;
check("recovery key is shown once at creation", Boolean(recoveryKey), panel.slice(0, 200));
if (recoveryKey) console.log(`        recovery key: ${recoveryKey}`);
const ack = page.locator('input[type="checkbox"]').last();
if (await ack.count()) await ack.check();
const done = page.getByRole("button", { name: /open my vault/i });
if (await done.count()) await done.first().click();
await page.waitForTimeout(2500);

// 3. Add a credential so we can prove the vault still decrypts after the reset
await page.goto(`${APP}/app/credentials/new`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
if (await has("#master-password")) {
  await page.fill("#master-password", MASTER);
  await page.waitForTimeout(400);
  await submit();
  await page.waitForTimeout(2500);
}
await page.waitForSelector("#application-name", { timeout: 20000 });
await page.fill("#application-name", "Recovery Probe");
await page.fill("#website-url", "https://example.org/recovery");
await page.fill("#username", "recovery.user");
await page.fill("#credential-password", "R3covery-QA-Pass!");
await submit();
await page.waitForURL(/\/app\/credentials\/[0-9a-f-]{36}/, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2000);
check("credential created before the reset", /\/app\/credentials\/[0-9a-f-]{36}/.test(page.url()), page.url());

// 4. Reload -> locked -> recover with the recovery key
await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
check("vault is locked after a reload", await has("#master-password"), (await bodyText()).slice(0, 140));
const recoveryTab = page.getByRole("button", { name: /use recovery key/i }).first();
if (await recoveryTab.count()) {
  await recoveryTab.click();
  await page.waitForTimeout(1200);
  await page.fill("#recovery-key", recoveryKey);
  await page.fill("#new-master-password", NEW_MASTER);
  await page.fill("#confirm-master-password", NEW_MASTER);
  await submit();
  await page.waitForTimeout(4000);
  const after = await bodyText();
  check("master password reset with the recovery key", !/cannot unlock|not valid/i.test(after), after.slice(0, 220));
  const newKey = (after.match(/[0-9A-Z]{4}(?:-[0-9A-Z]{4}){7}/) || [])[0] || null;
  check("a new recovery key is issued", Boolean(newKey) && newKey !== recoveryKey, `new=${newKey}`);
  const ack2 = page.locator('input[type="checkbox"]').last();
  if (await ack2.count()) await ack2.check();
  const openVault = page.getByRole("button", { name: /open my vault/i });
  if (await openVault.count()) await openVault.first().click();
  await page.waitForTimeout(2500);
} else {
  check("master password reset with the recovery key", false, "no recovery control");
}

// 5. The new master password opens the vault and the credential still decrypts
await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
if (await has("#master-password")) {
  await page.fill("#master-password", NEW_MASTER);
  await page.waitForTimeout(400);
  await submit();
  await page.waitForTimeout(3000);
}
check("vault opens with the new master password", !(await has("#master-password")), (await bodyText()).slice(0, 160));
await page.goto(`${APP}/app/credentials/new`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
if (await has("#master-password")) {
  await page.fill("#master-password", NEW_MASTER);
  await page.waitForTimeout(400);
  await submit();
  await page.waitForTimeout(3000);
}
const row = page.locator('a[href*="/app/credentials/"]:not([href*="/new"])').first();
if (await row.count()) {
  await row.click();
  await page.waitForTimeout(3000);
  const detail = await bodyText();
  check("the credential still decrypts after the reset", detail.includes("R3covery-QA-Pass!") || detail.includes("recovery.user"), detail.slice(0, 220));
} else {
  check("the credential still decrypts after the reset", false, "no credential row");
}

check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("\nAll recovery checks passed.");
}
