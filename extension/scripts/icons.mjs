/* eslint-disable no-console */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const SIZES = [16, 32, 48, 128];

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="30" fill="#0e2a1f"/>
  <rect x="1.5" y="1.5" width="125" height="125" rx="28.5" fill="none" stroke="#24402f" stroke-width="3"/>
  <circle cx="64" cy="52" r="20" fill="none" stroke="#c8f169" stroke-width="9"/>
  <path d="M64 72v30" fill="none" stroke="#c8f169" stroke-width="9" stroke-linecap="round"/>
  <circle cx="64" cy="52" r="6.5" fill="#c8f169"/>
</svg>
`;

export async function generateIcons(outDir) {
  await mkdir(outDir, { recursive: true });
  const source = Buffer.from(SVG);
  await Promise.all(
    SIZES.map((size) =>
      sharp(source)
        .resize(size, size)
        .png()
        .toFile(path.join(outDir, `icon-${size}.png`)),
    ),
  );
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entry === import.meta.url) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.join(here, "..", "dist", "icons");
  await generateIcons(outDir);
  console.log(`Wrote icons to ${outDir}`);
}
