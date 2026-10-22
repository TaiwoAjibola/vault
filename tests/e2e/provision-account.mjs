/* eslint-disable no-console */
/**
 * Provisions a permanent account on the live project: signs in, creates the
 * vault, captures the one-time recovery key, and seeds a couple of sample
 * credentials so the app has something to show.
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
  const build = readdirSync(cache).filter((n) => n.startsWith("chromium-")).sort().pop();
  const candidate = path.join(cache, build, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
  if (existsSync(candidate)) return { executablePath: candidate };
  return { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" };
}

const browser = await chromium.launch({ ...resolveBrowser(), headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const has = async (s) => (await page.locator(s).count()) > 0;
const bodyText = async () => page.locator("body").first().innerText().catch(() => "");

// Sign in
await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(3500);
console.log("signed in:", !page.url().includes("/login"), page.url());

// Create the vault and capture the recovery key
if (await has("#confirm-password")) {
  await page.fill("#master-password", MASTER);
  await page.fill("#confirm-password", MASTER);
  await page.locator('input[type="checkbox"]').first().check();
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForTimeout(4500);
  const panel = await bodyText();
  const recoveryKey = (panel.match(/[0-9A-Z]{4}(?:-[0-9A-Z]{4}){7}/) || [])[0] || null;
  console.log("RECOVERY_KEY:", recoveryKey ?? "not-found");
  const ack = page.locator('input[type="checkbox"]').last();
  if (await ack.count()) await ack.check();
  const done = page.getByRole("button", { name: /open my vault/i });
  if (await done.count()) await done.first().click();
  await page.waitForTimeout(2500);
  console.log("vault created, url:", page.url());
} else {
  console.log("vault already exists, skipping setup");
}

// Seed sample credentials
const samples = [
  {
    name: "GitHub",
    url: "https://github.com",
    username: "tawoajibola",
    password: "S3mple-GitHub-Pass!",
    notes: "Sample entry so the dashboard is not empty.",
  },
  {
    name: "Figma",
    url: "https://figma.com",
    username: "tawoajibola@example.com",
    password: "S3mple-Figma-Pass!",
    notes: "Replace with a real credential later.",
  },
];

for (const sample of samples) {
  await page.goto(`${APP}/app/credentials/new`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  if (await has("#master-password")) {
    await page.fill("#master-password", MASTER);
    await page.waitForTimeout(400);
    await page.locator('form button[type="submit"]').first().click();
    await page.waitForTimeout(2500);
  }
  await page.waitForSelector("#application-name", { timeout: 20000 }).catch(() => {});
  if (!(await has("#application-name"))) {
    console.log("form unavailable for", sample.name);
    continue;
  }
  await page.fill("#application-name", sample.name);
  await page.fill("#website-url", sample.url);
  await page.fill("#username", sample.username);
  await page.fill("#credential-password", sample.password);
  const notes = page.locator("#notes");
  if (await notes.count()) await notes.fill(sample.notes);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(/\/app\/credentials\/[0-9a-f-]{36}/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log(`saved ${sample.name}:`, /\/app\/credentials\/[0-9a-f-]{36}/.test(page.url()));
}

// Leave the session signed in for a final screenshot-free sanity check
await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const dashboard = await bodyText();
console.log("dashboard shows GitHub:", dashboard.includes("GitHub"));

await browser.close();
