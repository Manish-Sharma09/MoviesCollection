// A film's box office as a picture to share (1080 × 1350, the portrait size WhatsApp, Instagram and X show
// whole): poster, title, the running total in amber digits, a few stats and the site's address. Drawn on a
// canvas in the browser, so it always shows the figure on screen at that moment, live estimate included.
import { formatFine, formatMoney, type Currency } from '@/lib/format';
import { DAY, istMidnight, liveState } from '@/lib/live';
import type { LiveInfo, Money } from '@/lib/types';

export interface CardData {
  slug: string;
  title: string;
  /** Poster URL (Wikimedia, which allows cross-origin reads), or ''. */
  poster: string;
  /** The line above the title when the film is not in cinemas, e.g. "Box office · 2024". */
  kicker: string;
  /** In cinemas: the release day, to count "Day N in cinemas". */
  release: string | null;
  showing: boolean;
  native: Currency;
  gross: Money;
  live: LiveInfo | null;
  label: string;
  stats: { label: string; money?: Money; text?: string }[];
  site: string;
  host: string;
}

const W = 1080;
const H = 1350;
const PAD = 72;
const FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const C = {
  ink: '#0f1116', tile: '#20242e', amber: '#ffb020', accent: '#f59e0b', text: '#eef0f4', text2: '#a3a9b6',
  sep: 'rgba(255,255,255,0.16)', green: '#86efac', red: '#ef4444',
};

const font = (weight: number, px: number) => `${weight} ${px}px ${FONT}`;

async function loadPoster(url: string): Promise<ImageBitmap | null> {
  if (!url) return null;
  // A copy cached from a plain <img> request may lack the CORS header, so retry once past the cache.
  for (const cache of ['default', 'reload'] as RequestCache[]) {
    try {
      const res = await fetch(url, { mode: 'cors', cache });
      if (res.ok) return await createImageBitmap(await res.blob());
    } catch { /* try again, then go without */ }
  }
  return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws `img` to fill the box, cropping the overflow (like object-fit: cover). */
function cover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/** Splits text into at most `max` lines of `width`, ending the last with … when it does not fit. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
  kept[max - 1] = `${last.trimEnd()}…`;
  return kept;
}

/** The largest font size (from `from` down to `min`) at which `text` fits `width`. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, from: number, min: number, width: number) {
  let px = from;
  for (; px > min; px -= 4) {
    ctx.font = font(weight, px);
    if (ctx.measureText(text).width <= width) break;
  }
  ctx.font = font(weight, px);
  return px;
}

const timeIST = (ms: number) => new Date(ms).toLocaleString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
});

/** The figure the card and the share text show now: the live estimate while it runs, else the reported total. */
export function cardFigure(d: CardData, cur: Currency, now: number) {
  const state = d.live && d.showing ? liveState({ ...d.gross, ...d.live }, now) : null;
  return {
    state,
    text: state ? formatFine(cur, state.usd, state.inr) : formatMoney(d.gross, cur),
  };
}

export async function renderCard(d: CardData, cur: Currency, now: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  const other: Currency = cur === 'INR' ? 'USD' : 'INR';
  const { state, text: figure } = cardFigure(d, cur, now);
  const poster = await loadPoster(d.poster);

  // Ink background, lit from the top right by the poster blurred (drawn tiny, then scaled up smoothly:
  // a blur that works in every browser, unlike the canvas filter property).
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, W, H);
  if (poster) {
    const tiny = document.createElement('canvas');
    tiny.width = 18;
    tiny.height = 27;
    tiny.getContext('2d')!.drawImage(poster, 0, 0, 18, 27);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    cover(ctx, tiny, W * 0.2, -H * 0.15, W * 0.95, H * 0.85);
    ctx.restore();
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(15,17,22,0.35)');
  shade.addColorStop(0.5, 'rgba(15,17,22,0.88)');
  shade.addColorStop(1, C.ink);
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  const side = ctx.createLinearGradient(0, 0, W, 0);
  side.addColorStop(0, 'rgba(15,17,22,0.7)');
  side.addColorStop(1, 'rgba(15,17,22,0)');
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, W, H);

  // Brand row: an amber mark and the site's name; a live tag on the right while the estimate runs.
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.accent;
  roundRect(ctx, PAD, 72, 40, 40, 10);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.font = font(800, 26);
  ctx.textAlign = 'center';
  ctx.fillText('₹', PAD + 20, 93);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.text;
  ctx.font = font(700, 30);
  ctx.fillText(d.site, PAD + 56, 93);
  if (state) {
    ctx.font = font(700, 22);
    const tag = 'LIVE ESTIMATE';
    const tw = ctx.measureText(tag).width;
    const x = W - PAD - tw - 56;
    ctx.fillStyle = 'rgba(239,68,68,0.16)';
    roundRect(ctx, x, 72, tw + 56, 40, 20);
    ctx.fill();
    ctx.fillStyle = C.red;
    ctx.beginPath();
    ctx.arc(x + 22, 92, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fca5a5';
    ctx.fillText(tag, x + 38, 93);
  }

  // Poster and title.
  const top = 168;
  let textX = PAD;
  if (poster) {
    const pw = 300;
    const ph = 450;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = C.tile;
    roundRect(ctx, PAD, top, pw, ph, 20);
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, PAD, top, pw, ph, 20);
    ctx.clip();
    cover(ctx, poster, PAD, top, pw, ph);
    ctx.restore();
    textX = PAD + pw + 48;
  }
  const textW = W - PAD - textX;
  const day = d.showing && d.release ? Math.max(1, Math.floor((now - istMidnight(d.release)) / DAY) + 1) : null;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.accent;
  ctx.font = font(800, 26);
  ctx.fillText((day ? `Day ${day} in cinemas` : d.kicker).toUpperCase(), textX, top + 34);
  let size = 72;
  let lines: string[] = [];
  for (; size >= 48; size -= 6) {
    ctx.font = font(800, size);
    lines = wrap(ctx, d.title, textW, 4);
    if (lines.length <= 3 || size <= 48) break;
  }
  ctx.fillStyle = C.text;
  lines.forEach((line, i) => ctx.fillText(line, textX, top + 34 + 24 + size * 1.08 * (i + 1) - size * 0.2));

  // Perforation between the head and the figure, like the board on the site.
  const perf = 686;
  ctx.strokeStyle = C.sep;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(PAD, perf);
  ctx.lineTo(W - PAD, perf);
  ctx.stroke();
  ctx.setLineDash([]);

  // The figure.
  ctx.fillStyle = C.text2;
  ctx.font = font(700, 26);
  ctx.fillText((state ? 'Running total · worldwide' : d.label).toUpperCase(), PAD, perf + 76);
  ctx.fillStyle = C.amber;
  const figPx = fit(ctx, figure, 800, 150, 72, W - PAD * 2);
  ctx.fillText(figure, PAD, perf + 76 + 24 + figPx * 0.92);
  const line2Y = perf + 76 + 24 + figPx * 0.92 + 64;
  ctx.font = font(600, 34);
  ctx.fillStyle = C.text2;
  const second = state ? formatFine(other, state.usd, state.inr) : formatMoney(d.gross, other);
  ctx.fillText(second, PAD, line2Y);
  if (state && state.today.inr > 0) {
    const x = PAD + ctx.measureText(second).width + 28;
    const today = `Today +${formatFine(cur, state.today.usd, state.today.inr)}`;
    ctx.font = font(700, 32);
    const tw = ctx.measureText(today).width;
    ctx.fillStyle = 'rgba(74,222,128,0.16)';
    roundRect(ctx, x, line2Y - 38, tw + 32, 52, 10);
    ctx.fill();
    ctx.fillStyle = C.green;
    ctx.fillText(today, x + 16, line2Y);
  }

  // Up to three stats in columns with dashed rules between them.
  const stats = d.stats.slice(0, 3);
  if (stats.length) {
    const y = 1086;
    const colW = (W - PAD * 2) / stats.length;
    stats.forEach((s, i) => {
      const x = PAD + colW * i + (i ? 28 : 0);
      if (i) {
        ctx.strokeStyle = C.sep;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(PAD + colW * i, y - 30);
        ctx.lineTo(PAD + colW * i, y + 62);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = C.text2;
      ctx.font = font(600, 24);
      ctx.fillText(s.label, x, y);
      ctx.fillStyle = C.text;
      const value = s.money ? formatMoney(s.money, cur) : s.text ?? '';
      fit(ctx, value, 800, 46, 28, colW - 36);
      ctx.fillText(value, x, y + 56);
    });
  }

  // Footer: the address in amber, the time of the figure, and where it comes from.
  ctx.fillStyle = C.accent;
  ctx.font = font(800, 32);
  ctx.fillText(d.host, PAD, H - 96);
  ctx.fillStyle = C.text2;
  ctx.font = font(500, 24);
  ctx.textAlign = 'right';
  ctx.fillText(`${timeIST(now)} IST`, W - PAD, H - 96);
  ctx.textAlign = 'left';
  ctx.font = font(500, 21);
  ctx.fillText(state ? 'Reported figures from Wikipedia, live estimate in between.' : 'Reported figures, from Wikipedia.', PAD, H - 56);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}
