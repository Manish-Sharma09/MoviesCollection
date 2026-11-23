// Renders the PNG icons and the social share image into public/ with your local Google Chrome.
// Run it again after changing the site name or the logo:  npm run icons
// Needs macOS (uses `sips` to resize) and Google Chrome. The results are committed, so the daily
// GitHub build does not need Chrome.
import { writeFile, readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_NAME = process.env.SITE_NAME || 'Collection Board';
const OUT = fileURLToPath(new URL('../public/', import.meta.url));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const logo = await readFile(join(OUT, 'favicon.svg'), 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// The system font, like the site (SF Pro when rendered on a Mac).
const page = (w, h, body) => `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#000;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}</style></head><body>${body}</body></html>`;

// Square app icon, full bleed (phones round the corners themselves). The ticket sits inside the maskable safe zone.
const icon = page(512, 512, `<style>svg rect { rx: 0; }</style>${logo}`);

// 1200×630 share image: the site's hero — black, the app icon, a large tight headline with the warm gradient.
const og = page(1200, 630, `<div style="width:1200px;height:630px;box-sizing:border-box;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between;color:#f5f5f7;
background:radial-gradient(120% 90% at 100% 0%, #2a1a08 0%, rgba(0,0,0,0) 55%), #000">
<div style="display:flex;align-items:center;gap:20px">
<div style="width:84px;height:84px;flex:none">${logo}</div>
<div style="font-weight:600;font-size:40px;letter-spacing:-0.02em">${esc(SITE_NAME)}</div></div>
<div style="font-weight:700;font-size:112px;line-height:1.02;letter-spacing:-0.04em">Box office<br><span style="background:linear-gradient(90deg,#ffd27a,#ffab40 45%,#ff7f50);-webkit-background-clip:text;color:transparent">collections</span></div>
<div style="font-size:30px;line-height:1.35;letter-spacing:-0.01em;color:rgba(245,245,247,.7)">Live totals, day-wise figures and the crore clubs. Free, updated daily.</div>
</div>`);

const dir = await mkdtemp(join(tmpdir(), 'cb-icons-'));
const shot = async (html, w, h, out) => {
  const file = join(dir, `${w}x${h}.html`);
  await writeFile(file, html);
  execFileSync(CHROME, [
    '--headless=new', `--user-data-dir=${join(dir, 'chrome-profile')}`, '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${w},${h}`, '--virtual-time-budget=8000', `--screenshot=${out}`, `file://${file}`,
  ], { stdio: 'ignore' });
  const size = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', out]).toString();
  if (!size.includes(`pixelWidth: ${w}`) || !size.includes(`pixelHeight: ${h}`)) throw new Error(`Chrome gave the wrong size for ${out}:\n${size}`);
};
const resize = (from, px, to) => execFileSync('sips', ['-z', String(px), String(px), from, '--out', to], { stdio: 'ignore' });

try {
  const big = join(OUT, 'icon-512.png');
  await shot(icon, 512, 512, big);
  resize(big, 192, join(OUT, 'icon-192.png'));
  resize(big, 180, join(OUT, 'apple-touch-icon.png'));
  resize(big, 48, join(dir, '48.png'));
  resize(big, 32, join(dir, '32.png'));
  resize(big, 16, join(dir, '16.png'));
  await shot(og, 1200, 630, join(OUT, 'og-image.png'));

  // favicon.ico with PNG images inside (supported by every current browser).
  const images = await Promise.all([16, 32, 48].map(async (px) => ({ px, data: await readFile(join(dir, `${px}.png`)) })));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ px, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(px, at);
    header.writeUInt8(px, at + 1);
    header.writeUInt16LE(1, at + 4); // colour planes
    header.writeUInt16LE(32, at + 6); // bits per pixel
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  await writeFile(join(OUT, 'favicon.ico'), Buffer.concat([header, ...images.map((x) => x.data)]));
  console.log('Wrote public/icon-512.png, icon-192.png, apple-touch-icon.png, favicon.ico, og-image.png');
} finally {
  await rm(dir, { recursive: true, force: true });
}
