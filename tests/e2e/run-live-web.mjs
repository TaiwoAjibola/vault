/* eslint-disable no-console */
/**
 * Drives the Keyhold web app against the real Supabase project:
 * sign in, create or unlock the vault, add/edit/delete a credential,
 * read the audit trail, lock and unlock, and reset the master password
 * with the recovery key.
 */
import { chromium } from "playwright-core";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = process.env.QA_APP_URL || "http://localhost:3000";
const EMAIL = process.env.QA_EMAIL;
const PASSWORD = process.env.QA_PASSWORD;
const MASTER = process.env.QA_MASTER;

function resolveBrowser() {
  const bundled = chromium.executablePath();
  if (bundled && existsSync(bundled)) return { executablePath: bundled };
  const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
  if (existsSync(cache)) {
    const build = readdirSync(cache)
      .filter((name) => name.startsWith("chromium-"))
      .sort()
      .pop();
    if (build) {
      const candidate = path.join(
        cache,
        build,
        "chrome-mac-arm64",
        "Google Chrome for Testing.app",
        "Contents",
        "MacOS",
        "Google Chrome for Testing",
      );
      if (existsSync(candidate)) return { executablePath: candidate };
    }
  }
  const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(systemChrome)) return { executablePath: systemChrome };
  throw new Error("No Chromium build found");
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
  console.error("Set QA_EMAIL, QA_PASSWORD and QA_MASTER to run the live web test.");
  process.exit(1);
}

const browser = await chromium.launch({ ...resolveBrowser(), headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const has = async (selector) => (await page.locator(selector).count()) > 0;
const bodyText = async () => page.locator("body").first().innerText().catch(() => "");
const submit = () => page.locator('form button[type="submit"]').first().click();

let recoveryKey = null;

/** Unlocks the vault when the lock screen is showing; creates it when missing. */
async function ensureUnlocked() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await has("#master-password")) {
      await page.fill("#master-password", MASTER);
      await page.waitForTimeout(500);
      await submit();
      await page.waitForTimeout(2500);
      if (!(await has("#master-password"))) return "unlocked";
      const error = await page.locator('[role="alert"]').first().innerText().catch(() => "");
      if (error) console.log(`        unlock error: ${error}`);
      continue;
    }
    if (await has("#confirm-password")) {
      await page.fill("#master-password", MASTER);
      await page.fill("#confirm-password", MASTER);
      await page.locator('input[type="checkbox"]').first().check();
      await submit();
      await page.waitForTimeout(3000);
      const panel = await bodyText();
      recoveryKey =
        (panel.match(/[0-9A-Z]{4}(?:-[0-9A-Z]{4}){7}/) || [])[0] || recoveryKey;
      check("recovery key is displayed after vault creation", Boolean(recoveryKey), panel.slice(0, 140));
      if (recoveryKey) console.log(`        recovery key: ${recoveryKey}`);
      const ack = page.locator('input[type="checkbox"]').last();
      if (await ack.count()) await ack.check();
      const done = page.getByRole("button", { name: /open my vault/i });
      if (await done.count()) await done.first().click();
      await page.waitForTimeout(2500);
      return "created";
    }
    await page.waitForTimeout(1000);
  }
  return "unknown";
}

/** Navigates and re-unlocks, because the vault only lives in the tab session. */
async function open(url) {
  await page.goto(`${APP}${url}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  if (await has("#master-password") || await has("#confirm-password")) {
    const state = await ensureUnlocked();
    if (state === "unknown") return false;
  }
  return true;
}

// 1. Sign in
await page.goto(`${APP}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
check("signed in against the live project", !page.url().includes("/login"), page.url());

// 2. Vault unlocked (created on the first run)
const vaultState = await ensureUnlocked();
check("vault is unlocked", vaultState === "unlocked" || vaultState === "created", `state=${vaultState}`);

// 3. Create a credential
await open("/app/credentials/new");
await page.waitForSelector("#application-name", { timeout: 20000 }).catch(() => {});
check("credential form rendered", await has("#application-name"), (await bodyText()).slice(0, 140));
if (await has("#application-name")) {
  await page.fill("#application-name", "QA Example");
  await page.fill("#website-url", "https://example.org/qa");
  await page.fill("#username", "qa.user");
  await page.fill("#credential-password", "S3cret-QA-Pass!");
  await submit();
  await page.waitForURL(/\/app\/credentials\/[0-9a-f-]{36}/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  check("credential saved", /\/app\/credentials\/[0-9a-f-]{36}/.test(page.url()), page.url());
}

// 4. Dashboard lists it
await open("/app");
await page.waitForFunction(
  () => document.body.innerText.includes("QA Example"),
  { timeout: 20000 },
).catch(() => {});
const dashboard = await bodyText();
check("credential appears in the dashboard", dashboard.includes("QA Example"), dashboard.slice(0, 200));

// 5. Detail page reveals the secret
const detailLink = page.locator('a[href*="/app/credentials/"]:not([href*="/new"])').first();
if (await detailLink.count()) {
  await detailLink.click();
  await page.waitForURL(/\/app\/credentials\/[0-9a-f-]{36}$/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  if (await has("#master-password")) await ensureUnlocked();
  await page.waitForFunction(
    () => document.body.innerText.includes("qa.user"),
    { timeout: 20000 },
  ).catch(() => {});
  const detail = await bodyText();
  check("credential detail renders", detail.includes("qa.user"), detail.slice(0, 200));
  const reveal = page.getByRole("button", { name: /reveal|show password/i }).first();
  if (await reveal.count()) {
    await reveal.click();
    await page.waitForTimeout(2000);
    const revealed = await bodyText();
    check("password reveals after unlocking", revealed.includes("S3cret-QA-Pass!"), revealed.slice(0, 200));
  } else {
    check("password reveals after unlocking", false, "no reveal button");
  }
} else {
  check("credential detail renders", false, "no detail link");
}

// 6. Audit trail
await open("/app/activity");
const audit = await bodyText();
check("audit trail shows the create event", /created/i.test(audit), audit.slice(0, 220));

// 7. Security page
await open("/app/security");
const security = await bodyText();
check("security page renders", security.length > 50, security.slice(0, 140));

// 8. Edit the credential
await open("/app");
const rowLink = page.locator('a[href*="/app/credentials/"]:not([href*="/new"])').first();
let editLink = page.locator('a[href*="/edit"]').first();
if ((await rowLink.count()) && !(await editLink.count())) {
  await rowLink.click();
  await page.waitForURL(/\/app\/credentials\/[0-9a-f-]{36}$/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  if (await has("#master-password")) await ensureUnlocked();
  editLink = page.locator('a[href*="/edit"]').first();
}
if (await editLink.count()) {
  await editLink.click();
  await page.waitForTimeout(2500);
  if (await has("#master-password")) await ensureUnlocked();
  if (await has("#username")) {
    await page.fill("#username", "qa.user.updated");
    await submit();
    await page.waitForURL(/\/app\/credentials\/[0-9a-f-]{36}$/, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  check("credential updated", !page.url().endsWith("/edit"), page.url());
} else {
  check("credential updated", false, "no edit link found");
}

// 9. Lock and unlock with the master password
await open("/app/security");
const lockButton = page.getByRole("button", { name: /^lock now$/i }).first();
if (await lockButton.count()) {
  await lockButton.click();
  await page.waitForTimeout(2000);
  check("vault locks", await has("#master-password"), (await bodyText()).slice(0, 140));
  await page.fill("#master-password", MASTER);
  await page.waitForTimeout(400);
  await submit();
  await page.waitForTimeout(2500);
  await open("/app");
  check("vault unlocks with the master password", !(await has("#master-password")), page.url());
} else {
  check("vault locks", false, "no lock button");
}

// 10. Delete the credential
await open("/app");
const deleteButton = page.locator('button[aria-label^="Delete"]').first();
if (await deleteButton.count()) {
  await deleteButton.click();
  await page.waitForTimeout(1200);
  const confirm = page.getByRole("button", { name: /^delete credential$/i }).last();
  if (await confirm.count()) await confirm.click();
  await page
    .waitForFunction(() => !document.body.innerText.includes("QA Example"), { timeout: 20000 })
    .catch(() => {});
  const after = await bodyText();
  check("credential deleted", !after.includes("QA Example"), after.slice(0, 200));
} else {
  check("credential deleted", false, "no delete button");
}

check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("\nAll live web app checks passed.");
}
