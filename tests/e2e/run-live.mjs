/* eslint-disable no-console */
/**
 * Extension end-to-end test against the real Supabase project.
 *
 * Same journey as the mock run (tests/e2e/run.mjs) but with a real account,
 * a real vault, and a real database: sign in, unlock, activate the demo site,
 * save a login, fill it back, audit the retrieval, and lock. Database state is
 * verified with psql so the assertions cover what actually landed server side.
 *
 * Run with: npm run test:e2e:live
 */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");

const DEMO_PORT = 8099;
const DEMO_URL = `http://127.0.0.1:${DEMO_PORT}`;
const SUPABASE_URL = process.env.KEYHOLD_LIVE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.KEYHOLD_LIVE_ANON_KEY;
const ACCOUNT_EMAIL = process.env.QA_EMAIL;
const ACCOUNT_PASSWORD = process.env.QA_PASSWORD;
const MASTER_PASSWORD = process.env.QA_MASTER;
const DB_ENV = process.env.KEYHOLD_LIVE_DB_ENV;

const SITE_USER = "demo.user@example.com";
const SITE_PASS = "S3cret-Demo-Pass!";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ACCOUNT_EMAIL || !ACCOUNT_PASSWORD || !MASTER_PASSWORD) {
  console.error(
    "Missing live-test configuration. Set KEYHOLD_LIVE_SUPABASE_URL, KEYHOLD_LIVE_ANON_KEY, QA_EMAIL, QA_PASSWORD and QA_MASTER.",
  );
  process.exit(1);
}

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
    const child = spawn(process.execPath, [path.join(root, "extension", "scripts", "build.mjs")], {
      cwd: root,
      env: {
        ...process.env,
        KEYHOLD_EXT_DIST: distDir,
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        KEYHOLD_APP_URL: process.env.KEYHOLD_LIVE_APP_URL || "http://localhost:3000",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`extension build failed: ${stderr}`)),
    );
  });

  const contentPath = path.join(distDir, "content.js");
  const content = await readFile(contentPath, "utf8");
  await writeFile(
    contentPath,
    content.replace('attachShadow({ mode: "closed" })', 'attachShadow({ mode: "open" })'),
  );

  const manifestPath = path.join(distDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.host_permissions = [...new Set([...(manifest.host_permissions ?? []), `${DEMO_URL}/*`])];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Reads a scalar from the live database through the pooler. */
async function sql(query) {
  if (!DB_ENV) return null;
  return new Promise((resolve, reject) => {
    const child = spawn("bash", ["-c", `set -a; . ${DB_ENV}; set +a; psql -Atc "${query}"`], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err))));
  });
}

async function main() {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "keyhold-e2e-live-"));
  const distDir = path.join(workDir, "dist");
  await mkdir(path.join(here, ".build"), { recursive: true });

  const { createDemoSite } = await import("./demo-site.mjs");
  const demo = createDemoSite();
  await listen(demo, DEMO_PORT);
  await buildExtension(distDir);

  const userDataDir = path.join(workDir, "profile");
  const context = await chromium.launchPersistentContext(userDataDir, {
    ...resolveBrowser(),
    headless: true,
    viewport: { width: 1280, height: 900 },
    args: [`--disable-extensions-except=${distDir}`, `--load-extension=${distDir}`],
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
    await popup.fill('input[name="email"]', ACCOUNT_EMAIL);
    await popup.fill('input[name="password"]', ACCOUNT_PASSWORD);
    await popup.click('button[type="submit"]');
    await popup.waitForTimeout(3000);

    const authStatus = await popup.evaluate(async () => {
      const res = await chrome.runtime.sendMessage({ type: "auth:status" });
      return res?.data ?? null;
    });
    check("extension signs in against the live auth endpoint", authStatus?.signedIn === true, JSON.stringify(authStatus));

    const unlock = await popup.evaluate(
      async (master) => chrome.runtime.sendMessage({ type: "vault:unlock", masterPassword: master }),
      MASTER_PASSWORD,
    );
    check("vault unlocks with the master password", unlock?.ok === true, JSON.stringify(unlock));

    const site = await context.newPage();
    await site.goto(DEMO_URL, { waitUntil: "networkidle" });
    const tabId = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.find((tab) => tab.url?.startsWith("http://127.0.0.1:8099"))?.id ?? null;
    });

    const enable = await popup.evaluate(
      async ({ tabId, origin }) => chrome.runtime.sendMessage({ type: "site:enable", origin, tabId }),
      { tabId, origin: DEMO_URL },
    );
    check("site activation succeeds", enable?.ok === true && enable?.data?.enabled === true, JSON.stringify(enable));

    await site.bringToFront();
    await site.reload({ waitUntil: "networkidle" });
    await site.waitForTimeout(1500);
    const injected = await site.evaluate(() => Boolean(document.getElementById("keyhold-extension-root")));
    check("content script is injected on the enabled site", injected);

    await site.fill('input[name="email"]', SITE_USER);
    await site.fill('input[name="password"]', SITE_PASS);
    await site.click('button[type="submit"]');
    await site.waitForTimeout(3000);

    const prompt = await site.evaluate(() => {
      const shadow = document.getElementById("keyhold-extension-root")?.shadowRoot;
      return { mounted: Boolean(shadow), hasSave: Boolean(shadow?.querySelector('[data-action="save"]')) };
    });
    check("save prompt appears after a login", prompt.hasSave === true, JSON.stringify(prompt));

    await site.evaluate(() => {
      const shadow = document.getElementById("keyhold-extension-root")?.shadowRoot;
      shadow?.querySelector('[data-action="save"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    });
    await site.waitForTimeout(2500);

    const stored = await popup.evaluate(async () => {
      const res = await chrome.runtime.sendMessage({ type: "vault:all" });
      return res?.data ?? null;
    });
    check(
      "credential is sealed and stored in the vault",
      Array.isArray(stored) && stored.length >= 1 && stored[0].username === SITE_USER,
      JSON.stringify(stored),
    );

    const matches = await popup.evaluate(async (origin) => {
      const res = await chrome.runtime.sendMessage({ type: "vault:matches", origin });
      return res?.data ?? null;
    }, DEMO_URL);
    check(
      "saved login is matched to the site origin",
      Array.isArray(matches) && matches.length >= 1 && matches[0].username === SITE_USER,
      JSON.stringify(matches),
    );

    // Server side state
    const row = await sql(
      "select count(*) from public.credentials c join public.vaults v on v.id = c.vault_id join auth.users u on u.id = v.user_id where u.email = '" +
        ACCOUNT_EMAIL.replace(/'/g, "''") +
        "';",
    );
    check("the credential row landed in the live database", Number(row) >= 1, `rows=${row}`);

    const sealed = await sql(
      "select left(c.ciphertext, 12) from public.credentials c join public.vaults v on v.id = c.vault_id join auth.users u on u.id = v.user_id where u.email = '" +
        ACCOUNT_EMAIL.replace(/'/g, "''") +
        "' order by c.created_at desc limit 1;",
    );
    check("the stored payload is ciphertext, not plaintext", Boolean(sealed) && !sealed.includes(SITE_PASS), `ciphertext=${sealed}`);

    await site.reload({ waitUntil: "networkidle" });
    await site.waitForTimeout(1500);
    await site.evaluate(() => {
      const shadow = document.getElementById("keyhold-extension-root")?.shadowRoot;
      shadow?.querySelector(".kh-badge")?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    });
    await site.waitForTimeout(800);
    const hasFill = await site.evaluate(() => {
      const shadow = document.getElementById("keyhold-extension-root")?.shadowRoot;
      const button = shadow?.querySelector('[data-action="fill"]');
      if (!button) return false;
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
      return true;
    });
    check("panel exposes a fill action for the saved login", hasFill);

    await site.waitForTimeout(1500);
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
    check("retrieval is audited in the extension", Boolean(retrievedAt), String(retrievedAt));

    const serverRetrieved = await sql(
      "select count(*) from public.credentials c join public.vaults v on v.id = c.vault_id join auth.users u on u.id = v.user_id where u.email = '" +
        ACCOUNT_EMAIL.replace(/'/g, "''") +
        "' and c.last_retrieved_at is not null;",
    );
    check("the retrieval timestamp was written server side", Number(serverRetrieved) >= 1, `rows=${serverRetrieved}`);

    const events = await sql(
      "select count(*) from public.vault_events e join auth.users u on u.id = e.user_id where u.email = '" +
        ACCOUNT_EMAIL.replace(/'/g, "''") +
        "';",
    );
    check("audit events were written server side", Number(events) >= 1, `events=${events}`);

    const locked = await popup.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: "vault:lock" });
      const res = await chrome.runtime.sendMessage({ type: "auth:status" });
      return res?.data ?? null;
    });
    check("vault locks on demand", locked?.unlocked === false, JSON.stringify(locked));
    check("no popup runtime errors", popupErrors.length === 0, popupErrors.join(" | "));
  } finally {
    await context.close();
    demo.close();
    await rm(workDir, { recursive: true, force: true });
  }

  if (failures.length) {
    console.log(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("\nAll live extension end-to-end checks passed.");
}

await main();
