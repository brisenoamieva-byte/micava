/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const WINE = "#6E1F2C";
const CREAM = "#F5F1E8";

const markSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
  <rect x="20.5" y="2" width="7" height="3.2" rx="0.8" fill="${WINE}"/>
  <path fill="${WINE}" d="M21.4 5.2h5.2l.55 4.1c.05.4.22.77.48 1.07l.9 1.05c.35.4.54.92.54 1.46V14.2h-9.34v-1.32c0-.54.19-1.06.54-1.46l.9-1.05c.26-.3.43-.67.48-1.07l.55-4.1Z"/>
  <path fill="${WINE}" fill-rule="evenodd" d="M15.8 14.2h16.4c.66 0 1.2.54 1.2 1.2v1.1c0 .5-.2.97-.55 1.32l-2.55 2.55c-.28.28-.44.66-.44 1.06v1.35c0 .48.15.95.42 1.34l3.4 4.95c.5.73.78 1.6.78 2.5V41c0 1.88-1.52 3.4-3.4 3.4H16.94c-1.88 0-3.4-1.52-3.4-3.4V27.57c0-.9.28-1.77.78-2.5l3.4-4.95c.27-.39.42-.86.42-1.34v-1.35c0-.4-.16-.78-.44-1.06l-2.55-2.55A1.8 1.8 0 0 1 14.6 16.5v-1.1c0-.66.54-1.2 1.2-1.2ZM24 22.5c-3.05 0-5.5 2.4-5.5 5.35 0 3.4 4.35 8 5.25 9 .14.16.36.16.5 0 .9-1 5.25-5.6 5.25-9 0-2.95-2.45-5.35-5.5-5.35Zm0 3.15a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4Z"/>
</svg>`;

function appIconSvg(size) {
  const pad = Math.round(size * 0.18);
  const inner = size - pad * 2;
  const radius = Math.round(size * 0.22);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${CREAM}"/>
  <g transform="translate(${pad} ${pad}) scale(${inner / 48})">
    <rect x="20.5" y="2" width="7" height="3.2" rx="0.8" fill="${WINE}"/>
    <path fill="${WINE}" d="M21.4 5.2h5.2l.55 4.1c.05.4.22.77.48 1.07l.9 1.05c.35.4.54.92.54 1.46V14.2h-9.34v-1.32c0-.54.19-1.06.54-1.46l.9-1.05c.26-.3.43-.67.48-1.07l.55-4.1Z"/>
    <path fill="${WINE}" fill-rule="evenodd" d="M15.8 14.2h16.4c.66 0 1.2.54 1.2 1.2v1.1c0 .5-.2.97-.55 1.32l-2.55 2.55c-.28.28-.44.66-.44 1.06v1.35c0 .48.15.95.42 1.34l3.4 4.95c.5.73.78 1.6.78 2.5V41c0 1.88-1.52 3.4-3.4 3.4H16.94c-1.88 0-3.4-1.52-3.4-3.4V27.57c0-.9.28-1.77.78-2.5l3.4-4.95c.27-.39.42-.86.42-1.34v-1.35c0-.4-.16-.78-.44-1.06l-2.55-2.55A1.8 1.8 0 0 1 14.6 16.5v-1.1c0-.66.54-1.2 1.2-1.2ZM24 22.5c-3.05 0-5.5 2.4-5.5 5.35 0 3.4 4.35 8 5.25 9 .14.16.36.16.5 0 .9-1 5.25-5.6 5.25-9 0-2.95-2.45-5.35-5.5-5.35Zm0 3.15a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4Z"/>
  </g>
</svg>`;
}

async function writePng(file, svg, size) {
  const out = path.join(ROOT, file);
  await fs.promises.mkdir(path.dirname(out), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log("wrote", file);
}

async function main() {
  await fs.promises.mkdir(path.join(ROOT, "public/brand"), { recursive: true });
  await fs.promises.writeFile(
    path.join(ROOT, "public/brand/cavatale-mark.svg"),
    markSvg,
    "utf8"
  );
  console.log("wrote public/brand/cavatale-mark.svg");

  // Transparent mark for brand asset
  await writePng("public/brand/cavatale-mark.png", markSvg, 512);

  // App / PWA / favicon tiles
  await writePng("public/icons/icon-512.png", appIconSvg(512), 512);
  await writePng("public/icons/icon-192.png", appIconSvg(192), 192);
  await writePng("public/apple-touch-icon.png", appIconSvg(180), 180);
  await writePng("public/icon.png", appIconSvg(512), 512);
  await writePng("public/favicon-32.png", appIconSvg(32), 32);
  await writePng("public/favicon-16.png", appIconSvg(16), 16);

  // favicon.ico from 32px png
  await sharp(Buffer.from(appIconSvg(32)))
    .resize(32, 32)
    .png()
    .toFile(path.join(ROOT, "public/favicon.ico"));
  console.log("wrote public/favicon.ico (png bytes; browsers accept)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
