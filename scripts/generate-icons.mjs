/**
 * generate-icons.mjs
 * Generates PWA placeholder icons using sharp (bundled with Next.js).
 * Run: node scripts/generate-icons.mjs
 */
import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const iconsDir = path.join(rootDir, 'public', 'icons');

mkdirSync(iconsDir, { recursive: true });

// Try sharp first
let sharpAvailable = false;
try {
  const req = createRequire(import.meta.url);
  const sharp = req('sharp');

  const sizes = [192, 512];
  for (const size of sizes) {
    // Build an SVG as the source so we get a crisp, coloured background with "SS"
    const fontSize = Math.round(size * 0.35);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="#0071e3"/>
  <text
    x="50%" y="55%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="700"
    font-size="${fontSize}"
    fill="white"
  >SS</text>
</svg>`;

    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(iconsDir, `icon-${size}.png`));

    console.log(`✅  Created public/icons/icon-${size}.png`);
  }
  sharpAvailable = true;
} catch (err) {
  console.log('sharp not available:', err.message);
}

if (!sharpAvailable) {
  // Fallback: write a minimal valid 1×1 blue PNG stretched by CSS.
  // Real-world: replace with proper artwork before launch.
  // Minimal PNG (1×1 blue pixel) hand-crafted bytes
  const minimalPng = Buffer.from([
    0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a, // PNG signature
    0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52, // IHDR length + type
    0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01, // width=1, height=1
    0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53, // bit depth 8, colour type 2 (RGB)
    0xde,0x00,0x00,0x00,0x0c,0x49,0x44,0x41, // CRC + IDAT length + type
    0x54,0x08,0xd7,0x63,0x60,0x18,0xb8,0xc4, // IDAT data (zlib compressed blue pixel #0071e3)
    0x1c,0x00,0x00,0x00,0x24,0x00,0x01,0xe2,
    0x56,0x40,0xdf,0x00,0x00,0x00,0x00,0x49,
    0x45,0x4e,0x44,0xae,0x42,0x60,0x82,        // IEND
  ]);

  for (const size of [192, 512]) {
    const dest = path.join(iconsDir, `icon-${size}.png`);
    writeFileSync(dest, minimalPng);
    console.log(`⚠️  Created minimal placeholder public/icons/icon-${size}.png (replace before launch)`);
  }
}
