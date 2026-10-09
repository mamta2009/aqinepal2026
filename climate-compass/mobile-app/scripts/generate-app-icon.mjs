/**
 * Generates app icon PNGs from the brand red triangle (#d32f2f).
 * Run: node scripts/generate-app-icon.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../assets/images");

const RED = "#d32f2f";
const BG = "#0f1419";

function triangleSvg(size, { color = RED, background = null, inset = 0.18 } = {}) {
  const pad = size * inset;
  const cx = size / 2;
  const top = pad;
  const bottom = size - pad;
  const left = pad;
  const right = size - pad;
  const bgRect = background
    ? `<rect width="${size}" height="${size}" fill="${background}"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${bgRect}
<path d="M ${cx} ${top} L ${right} ${bottom} L ${left} ${bottom} Z" fill="${color}"/>
</svg>`;
}

async function writePng(filename, svg, size) {
  const outPath = path.join(outDir, filename);
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log(`Wrote ${outPath}`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  await writePng("icon.png", triangleSvg(1024, { background: BG }), 1024);
  await writePng(
    "android-icon-foreground.png",
    triangleSvg(1024, { inset: 0.22 }),
    1024,
  );
  await writePng(
    "android-icon-monochrome.png",
    triangleSvg(1024, { color: "#ffffff", inset: 0.22 }),
    1024,
  );
  await writePng(
    "android-icon-background.png",
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BG}"/></svg>`,
    1024,
  );
  await writePng(
    "splash-icon.png",
    triangleSvg(512, { inset: 0.2 }),
    512,
  );
  await writePng(
    "favicon.png",
    triangleSvg(192, { background: BG, inset: 0.2 }),
    192,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
