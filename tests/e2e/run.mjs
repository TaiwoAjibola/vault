/* eslint-disable no-console */
/**
 * Extension end-to-end test.
 *
 * Boots an in-memory Supabase stand-in plus a demo login site, builds a
 * throwaway extension bundle pointed at the mock, drives Chromium through
 * sign-in, unlock, site activation, save prompt, and credential fill, then
 * reports every check.
 *
 * Run with: npm run test:e2e
 */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync } from "node:fs";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");

const SUPABASE_PORT = 54321;
const DEMO_PORT = 8099;
const SUPABASE_URL = `http://127.0.0.1:${SUPABASE_PORT}`;
const DEMO_URL = `http://127.0.0.1:${DEMO_PORT}`;
const SITE_USER = "demo.user@example.com";
const SITE_PASS = "S3cret-Demo-Pass!";

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
  throw new Error("No Chromium build was found. Run: npx playwright install chromium");
}

const failures = [];
function check(name, condition, extra = "") {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

async function listen(server, port) {
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
}

async function buildExtension(distDir) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(root, "extension", "scripts", "build.mjs")],
      {
        cwd: root,
        env: {
          ...process.env,
          KEYHOLD_EXT_DIST: distDir,
          SUPABASE_URL,
          SUPABASE_ANON_KEY: "qa-anon-key",
          KEYHOLD_APP_URL: "http://localhost:3001",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`extension build failed: ${stderr}`)),
    );
  });

  // The panel uses a closed shadow root in production. The test build opens it
  // so assertions can reach the UI without weakening the shipped bundle.
  const contentPath = path.join(distDir, "content.js");
  const content = await readFile(contentPath, "utf8");
  await writeFile(
    contentPath,
    content.replace('attachShadow({ mode: "closed" })', 'attachShadow({ mode: "open" })'),
  );

  // The demo origin needs host access; headless Chromium cannot show the
  // permission bubble, so the test bundle grants it up front.
  const manifestPath = path.join(distDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.host_permissions = [...new Set([...(manifest.host_permissions ?? []), `${DEMO_URL}/*`])];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "keyhold-e2e-"));
  const distDir = path.join(workDir, "dist");
  const cryptoOut = path.join(here, ".build", "crypto.mjs");
  await mkdir(path.dirname(cryptoOut), { recursive: true });

  const esbuild = spawn(
    path.join(root, "node_modules", ".bin", "esbuild"),
    [
      path.join(root, "src", "lib", "vault", "crypto.ts"),
      "--bundle",
      "--format=esm",
      "--platform=node",
      `--outfile=${cryptoOut}`,
      "--log-level=error",
    ],
    { cwd: root, stdio: "inherit" },
  );
  await new Promise((resolve, reject) => {
    esbuild.on("error", reject);
    esbuild.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("esbuild failed"))));
  });

  const { ACCOUNT_PASSWORD, MASTER_PASSWORD, USER_EMAIL, createMockSupabase } = await import(
    "./mock-supabase.mjs"
  );
  const { createDemoSite } = await import("./demo-site.mjs");

  const supabase = createMockSupabase();
  const demo = createDemoSite();
  await listen(supabase, SUPABASE_PORT);
  await listen(demo, DEMO_PORT);

  await buildExtension(distDir);

  const userDataDir = path.join(workDir, "profile");
  const context = await chromium.launchPersistentContext(userDataDir, {
    ...resolveBrowser(),
    headless: true,
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
    ],
  });

  try {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent("serviceworker");
    const extensionId = worker.url().split("/")[2];

    const popup = await context.newPage();
    const popupErrors = [];
    popup.on("pageerror", (error) => popupErrors.push(error.message));

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForSelector('input[name="email"]', { timeout: 15000 });
    await popup.fill('input[name="email"]', USER_EMAIL);
    await popup.fill('input[name="password"]', ACCOUNT_PASSWORD);
    await popup.click('button[type="submit"]');
    await popup.waitForTimeout(1200);

    const authStatus = await popup.evaluate(async () => {
      const res = await chrome.runtime.sendMessage({ type: "auth:status" });
      return res?.data ?? null;
    });
    check("popup signs in against the auth endpoint", authStatus?.signedIn === true, JSON.stringify(authStatus));

    const unlock = await popup.evaluate(async (master) => {
      return chrome.runtime.sendMessage({ type: "vault:unlock", masterPassword: master });
    }, MASTER_PASSWORD);
    check("vault unlocks with the master password", unlock?.ok === true, JSON.stringify(unlock));

    const site = await context.newPage();
    await site.goto(DEMO_URL, { waitUntil: "networkidle" });
    const tabId = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.find((tab) => tab.url?.startsWith("http://127.0.0.1:8099"))?.id ?? null;
    });

    const enable = await popup.evaluate(
      async ({ tabId, origin }) =>
        chrome.runtime.sendMessage({ type: "site:enable", origin, tabId }),
      { tabId, origin: DEMO_URL },
    );
    check("site activation succeeds", enable?.ok === true && enable?.data?.enabled === true, JSON.stringify(enable));

    await site.bringToFront();
    await site.reload({ waitUntil: "networkidle" });
    await site.waitForTimeout(1200);
    const injected = await site.evaluate(() => Boolean(document.getElementById("keyhold-extension-root")));
    check("content script is injected on the enabled site", injected);

    await site.fill('input[name="email"]', SITE_USER);
    await site.fill('input[name="password"]', SITE_PASS);
    await site.click('button[type="submit"]');
    await site.waitForTimeout(2600);

    const prompt = await site.evaluate(() => {
      const shadow = document.getElementById("keyhold-extension-root")?.shadowRoot;
      return {
        mounted: Boolean(shadow),
        hasSave: Boolean(shadow?.querySelector('[data-action="save"]')),
      };
    });
    check("save prompt appears after a login", prompt.hasSave === true, JSON.stringify(prompt));

    await site.evaluate(() => {
      const shadow = document.getElementById("keyhold-extension-root")?.shadowRoot;
      shadow
        ?.querySelector('[data-action="save"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    });
    await site.waitForTimeout(1500);

    const stored = await popup.evaluate(async () => {
      const res = await chrome.runtime.sendMessage({ type: "vault:all" });
      return res?.data ?? null;
    });
    check(
      "credential is sealed and stored in the vault",
      Array.isArray(stored) && stored.length === 1 && stored[0].username === SITE_USER,
      JSON.stringify(stored),
    );

    const matches = await popup.evaluate(async (origin) => {
      const res = await chrome.runtime.sendMessage({ type: "vault:matches", origin });
      return res?.data ?? null;
    }, DEMO_URL);
    check(
      "saved login is matched to the site origin",
      Array.isArray(matches) && matches.length === 1 && matches[0].username === SITE_USER,
      JSON.stringify(matches),
    );

    await site.reload({ waitUntil: "networkidle" });
    await site.waitForTimeout(1200);
    const fillClicked = await site.evaluate(() => {
      const shadow = document.getElementById("keyhold-extension-root")?.shadowRoot;
      shadow
        ?.querySelector(".kh-badge")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
      return true;
    });
    await site.waitForTimeout(600);
    const hasFill = await site.evaluate(() => {
      const shadow = document.getElementById("keyhold-extension-root")?.shadowRoot;
      const button = shadow?.querySelector('[data-action="fill"]');
      if (!button) return false;
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
      return true;
    });
    check("panel exposes a fill action for the saved login", fillClicked && hasFill);

    await site.waitForTimeout(1200);
    const filled = await site.evaluate(() => ({
      email: document.querySelector('input[name="email"]')?.value ?? "",
      password: document.querySelector('input[name="password"]')?.value ?? "",
    }));
    check(
      "credentials are filled back into the site",
      filled.email === SITE_USER && filled.password === SITE_PASS,
      JSON.stringify(filled),
    );

    const retrievedAt = await popup.evaluate(async () => {
      const res = await chrome.runtime.sendMessage({ type: "vault:all" });
      return res?.data?.[0]?.lastRetrievedAt ?? null;
    });
    check("retrieval is audited", Boolean(retrievedAt), String(retrievedAt));

    const locked = await popup.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: "vault:lock" });
      const res = await chrome.runtime.sendMessage({ type: "auth:status" });
      return res?.data ?? null;
    });
    check("vault locks on demand", locked?.unlocked === false, JSON.stringify(locked));
    check("no popup runtime errors", popupErrors.length === 0, popupErrors.join(" | "));
  } finally {
    await context.close();
    supabase.close();
    demo.close();
    await rm(workDir, { recursive: true, force: true });
  }

  if (failures.length) {
    console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("\nAll extension end-to-end checks passed.");
}

await main();
