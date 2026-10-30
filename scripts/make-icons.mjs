// Draws the app icon (a pinked denim swatch with a selvedge line) and renders the PNG sizes.
// Run with: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Uses the machine's installed Playwright rather than a project dependency.
const { chromium } = createRequire(import.meta.url)('playwright');

const x0 = 120, x1 = 392, y0 = 128, y1 = 384, tooth = 272 / 12, amp = 12;
let d = `M${x0},${y0 + amp}`;
for (let x = x0; x < x1 - 0.1; x += tooth) d += ` L${x + tooth / 2},${y0} L${x + tooth},${y0 + amp}`;
d += ` L${x1},${y1 - amp}`;
for (let x = x1; x > x0 + 0.1; x -= tooth) d += ` L${x - tooth / 2},${y1} L${x - tooth},${y1 - amp}`;
d += ' Z';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#e3e8ed"/>
  <path d="${d}" fill="#23314d"/>
  <rect x="340" y="${y0 + amp}" width="10" height="${y1 - y0 - 2 * amp}" fill="#f4f1ee"/>
  <rect x="350" y="${y0 + amp}" width="14" height="${y1 - y0 - 2 * amp}" fill="#ad342d"/>
</svg>`;
writeFileSync('public/favicon.svg', svg);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}</style>${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
  await page.screenshot({ path: `public/${name}` });
}
await browser.close();
