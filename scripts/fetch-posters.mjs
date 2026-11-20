// Film posters from English Wikipedia: the image in each film article's infobox, via the free MediaWiki
// API (PageImages), 50 articles per request, no key. Posters are copyrighted; Wikipedia shows them at low
// resolution to identify the film, and the site uses them the same way (small, next to the film's figures).
//
// Cached in data/raw/posters.json by article title. A run only re-reads posters older than 30 days, or
// 2 days for films released in the last 90 days (their posters are often added or replaced late).
// Run after scripts/merge.mjs (it reads data/movies.json).
import { readFile, rename, writeFile } from 'node:fs/promises';
import { getJson, sleep } from './lib/http.mjs';

const OUT = new URL('../data/raw/posters.json', import.meta.url);
const TMP = new URL('../data/raw/posters.json.tmp', import.meta.url);
const DAY = 86_400_000;
const now = Date.now();
const BATCH = 50;
// Wikimedia serves thumbnails in standard widths; 330 matches the site's largest card size.
const THUMB = 330;

const cache = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => ({}));
cache.pages ||= {};
const save = async () => {
  cache.fetchedAt = new Date().toISOString();
  await writeFile(TMP, JSON.stringify(cache));
  await rename(TMP, OUT);
};

const { films } = JSON.parse(await readFile(new URL('../data/movies.json', import.meta.url), 'utf8'));
const isRecent = (f) => f.date && now - Date.parse(f.date) >= 0 && now - Date.parse(f.date) < 90 * DAY;
const todo = films
  .filter((f) => f.enwiki)
  // Re-read when out of date, or when an earlier version of this script found no poster (v < 2 rejected
  // posters served from thumb.wikimedia.org).
  .filter((f) => {
    const entry = cache.pages[f.enwiki];
    if (entry && !entry.thumb && (entry.v || 1) < 2) return true;
    return !(now - (entry?.checkedAt || 0) < (isRecent(f) ? 2 : 30) * DAY);
  })
  .map((f) => f.enwiki);
const titles = [...new Set(todo)];
console.log(`Posters: ${films.length} films, reading ${titles.length} from Wikipedia`);

let found = 0;
for (let i = 0; i < titles.length; i += BATCH) {
  const batch = titles.slice(i, i + BATCH);
  const params = new URLSearchParams({
    action: 'query', prop: 'pageimages', piprop: 'thumbnail|original|name', pithumbsize: String(THUMB),
    pilicense: 'any', pilimit: String(BATCH), redirects: '1', format: 'json', formatversion: '2', maxlag: '5',
    titles: batch.join('|'),
  });
  const json = await getJson(`https://en.wikipedia.org/w/api.php?${params}`, {}, { label: 'posters' });
  if (json.error?.code === 'maxlag') { await sleep(5000); i -= BATCH; continue; }
  // Map the titles we asked for to the article titles that came back (normalised, redirected).
  const finalOf = new Map(batch.map((t) => [t, t]));
  for (const n of json.query?.normalized || []) for (const [k, v] of finalOf) if (v === n.from) finalOf.set(k, n.to);
  for (const r of json.query?.redirects || []) for (const [k, v] of finalOf) if (v === r.from) finalOf.set(k, r.to);
  const byTitle = new Map((json.query?.pages || []).map((p) => [p.title, p]));
  for (const title of batch) {
    const page = byTitle.get(finalOf.get(title));
    const thumb = page?.thumbnail?.source;
    const original = page?.original;
    if (thumb && /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(thumb) && !/\.svg/i.test(page.pageimage || '')) {
      cache.pages[title] = { thumb, width: original?.width || page.thumbnail.width, original: original?.source || thumb, checkedAt: now, v: 2 };
      found++;
    } else {
      cache.pages[title] = { checkedAt: now, v: 2 };
    }
  }
  process.stdout.write(`  ${Math.min(i + BATCH, titles.length)}/${titles.length}, posters found ${found}\r`);
  if ((i / BATCH) % 20 === 19) await save();
  await sleep(250);
}
console.log();
await save();
const total = Object.values(cache.pages).filter((p) => p.thumb).length;
console.log(`Posters: ${total} films with a Wikipedia poster → data/raw/posters.json`);
