/**
 * Renders the app icons from the SVG sources in assets/brand.
 * Run after changing an icon: `npm run icons`. Outputs are committed.
 *
 *   src/app/icon.svg            – browser tab icon (copied as-is)
 *   src/app/favicon.ico         – 16/32/48 px, for old browsers
 *   src/app/apple-icon.png      – 180 px home-screen icon (iOS)
 *   public/icons/icon-*.png     – PWA icons (192, 512, maskable 512)
 *   public/icons/badge-96.png   – monochrome badge for web push on Android
 */
import { copyFile, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const path = (p) => new URL(p, root);

const icon = await readFile(path("assets/brand/app-icon.svg"));
const maskable = await readFile(path("assets/brand/app-icon-maskable.svg"));
const badge = await readFile(path("assets/brand/notification-badge.svg"));

const png = (svg, size) => sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** Minimal ICO container holding PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

await copyFile(path("assets/brand/app-icon.svg"), path("src/app/icon.svg"));
await writeFile(
  path("src/app/favicon.ico"),
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(icon, size) })))),
);
// iOS ignores transparency and rounds corners itself: use the full-bleed square.
await writeFile(path("src/app/apple-icon.png"), await png(maskable, 180));
await writeFile(path("public/icons/icon-192.png"), await png(icon, 192));
await writeFile(path("public/icons/icon-512.png"), await png(icon, 512));
await writeFile(path("public/icons/icon-maskable-512.png"), await png(maskable, 512));
await writeFile(path("public/icons/badge-96.png"), await png(badge, 96));

console.log("✔ App icons written");
