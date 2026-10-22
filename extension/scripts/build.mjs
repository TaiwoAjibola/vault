/* eslint-disable no-console */
import { build, context } from "esbuild";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateIcons } from "./icons.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const dist = process.env.KEYHOLD_EXT_DIST
  ? path.resolve(process.env.KEYHOLD_EXT_DIST)
  : path.join(root, "dist");
const watch = process.argv.includes("--watch");
const minify = process.argv.includes("--minify");

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2]?.trim() ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

async function loadEnv() {
  let fileEnv = {};
  try {
    fileEnv = parseEnv(await readFile(path.join(root, ".env"), "utf8"));
  } catch {
    fileEnv = {};
  }
  return { ...fileEnv, ...process.env };
}

function requiredOrigin(value, name) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("bad protocol");
    return url.origin;
  } catch {
    throw new Error(`${name} must be an absolute http(s) URL. Received: ${value || "(empty)"}`);
  }
}

function staticFiles() {
  return Promise.all([
    copyFile(path.join(root, "popup.html"), path.join(dist, "popup.html")),
    copyFile(path.join(root, "unlock.html"), path.join(dist, "unlock.html")),
    copyFile(path.join(root, "src", "popup.css"), path.join(dist, "popup.css")),
    copyFile(path.join(root, "src", "unlock.css"), path.join(dist, "unlock.css")),
    copyFile(path.join(root, "src", "content.css"), path.join(dist, "content.css")),
  ]);
}

async function writeManifest(config) {
  const base = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  const packageJson = JSON.parse(await readFile(path.join(root, "..", "package.json"), "utf8"));
  const supabaseOrigin = requiredOrigin(config.supabaseUrl, "SUPABASE_URL");
  const appOrigin = requiredOrigin(config.appUrl, "KEYHOLD_APP_URL");
  const manifest = {
    ...base,
    version: packageJson.version,
    host_permissions: [...new Set([`${supabaseOrigin}/*`, `${appOrigin}/*`])],
  };
  await writeFile(path.join(dist, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function prepare() {
  const env = await loadEnv();
  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const appUrl = env.KEYHOLD_APP_URL ?? env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      [
        "Missing Supabase configuration for the extension.",
        "Copy extension/.env.example to extension/.env and fill in:",
        "  SUPABASE_URL, SUPABASE_ANON_KEY, KEYHOLD_APP_URL",
      ].join("\n"),
    );
  }
  if (anonKey.startsWith("replace-")) {
    throw new Error("SUPABASE_ANON_KEY still contains the example placeholder.");
  }

  const config = {
    supabaseUrl: requiredOrigin(supabaseUrl, "SUPABASE_URL"),
    anonKey,
    appUrl: requiredOrigin(appUrl, "KEYHOLD_APP_URL"),
  };

  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await staticFiles();
  await writeManifest(config);
  await generateIcons(path.join(dist, "icons"));
  return config;
}

const config = await prepare();

const options = {
  entryPoints: {
    background: path.join(root, "src", "background.ts"),
    content: path.join(root, "src", "content.ts"),
    popup: path.join(root, "src", "popup-main.tsx"),
    unlock: path.join(root, "src", "unlock-main.tsx"),
  },
  outdir: dist,
  entryNames: "[name]",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome116"],
  jsx: "automatic",
  define: {
    __KEYHOLD_CONFIG__: JSON.stringify(config),
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  sourcemap: !minify,
  minify,
  legalComments: "none",
  logLevel: "info",
};

if (watch) {
  const buildContext = await context(options);
  await buildContext.watch();
  console.log("Watching extension sources. Reload the extension in chrome://extensions after changes.");
} else {
  await build(options);
  console.log(`Built Keyhold extension into ${dist}`);
  console.log("Load unpacked extension from that folder in chrome://extensions.");
}
