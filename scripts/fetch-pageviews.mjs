// How many people read each recent film's English Wikipedia article in the last 7 days, from the free MediaWiki
// API (prop=pageviews, no key, 50 articles per request). Human readers only: Wikimedia leaves out bots and
// crawlers. The home page's "Trending this week" row ranks films by it.
//
// Reads films released in the last year and every upcoming film from data/movies.json, so run it after
// scripts/merge.mjs. Output: data/raw/pageviews.json → { through, windowDays, pages: { title: { views, days } } }.
// Wikimedia publishes a day's figures a few hours after midnight UTC, so a run within 6 hours of the last one
// reads nothing new. Not critical to the site: if Wikipedia cannot be reached, the previous figures are kept
// and the build goes on.
import { readFile, rename, writeFile } from 'node:fs/promises';
import { getJson, sleep } from './lib/http.mjs';

const OUT = new URL('../data/raw/pageviews.json', import.meta.url);
const TMP = new URL('../data/raw/pageviews.json.tmp', import.meta.url);
const DAY = 86_400_000;
const WINDOW_DAYS = 7;
const RECENT_DAYS = 365;
const BATCH = 50;
const FRESH_MS = 6 * 3_600_000;

const cache = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => ({}));

const { films = [], upcoming = [] } = JSON.parse(await readFile(new URL('../data/movies.json', import.meta.url), 'utf8'));
const cutoff = Date.now() - RECENT_DAYS * DAY;
const titles = [...new Set([
  ...films.filter((f) => f.enwiki && f.date && Date.parse(f.date) >= cutoff).map((f) => f.enwiki),
  ...upcoming.filter((f) => f.enwiki).map((f) => f.enwiki),
])];

const fresh = Date.now() - Date.parse(cache.fetchedAt || 0) < FRESH_MS && titles.every((t) => cache.pages?.[t]);
if (fresh) {
  console.log(`Page views: read ${cache.fetchedAt}, still fresh (through ${cache.through})`);
  process.exit(0);
}
console.log(`Page views: reading ${titles.length} recent and upcoming films from Wikipedia`);

const pages = {};
let through = '';
try {
  for (let i = 0; i < titles.length; i += BATCH) {
    const batch = titles.slice(i, i + BATCH);
    const finalOf = new Map(batch.map((t) => [t, t]));
    const views = new Map();
    // The API can split one batch's figures over several responses (pvipcontinue).
    for (let cont = {}; cont;) {
      const params = new URLSearchParams({
        action: 'query', prop: 'pageviews', pvipdays: String(WINDOW_DAYS), redirects: '1',
        format: 'json', formatversion: '2', maxlag: '5', titles: batch.join('|'), ...cont,
      });
      const json = await getJson(`https://en.wikipedia.org/w/api.php?${params}`, {}, { label: 'page views', retries: 3 });
      if (json.error?.code === 'maxlag') { await sleep(5000); continue; }
      if (json.error) throw new Error(`${json.error.code}: ${json.error.info}`);
      // Map the titles we asked for to the article titles that came back (normalised, redirected).
      for (const n of json.query?.normalized || []) for (const [k, v] of finalOf) if (v === n.from) finalOf.set(k, n.to);
      for (const r of json.query?.redirects || []) for (const [k, v] of finalOf) if (v === r.from) finalOf.set(k, r.to);
      for (const p of json.query?.pages || []) if (p.pageviews) views.set(p.title, p.pageviews);
      cont = json.continue?.pvipcontinue ? json.continue : null;
      await sleep(500);
    }
    for (const title of batch) {
      const byDay = views.get(finalOf.get(title));
      if (!byDay) continue; // missing article, or figures still to come in a continuation that failed
      const dates = Object.keys(byDay).sort();
      if (dates.at(-1) > through) through = dates.at(-1);
      const days = dates.map((d) => byDay[d] ?? 0);
      pages[title] = { views: days.reduce((a, b) => a + b, 0), days };
    }
    process.stdout.write(`  ${Math.min(i + BATCH, titles.length)}/${titles.length}\r`);
  }
} catch (err) {
  console.warn(`\nPage views: Wikipedia not reachable (${err.message}); keeping the previous figures.`);
  process.exit(0);
}
console.log();

await writeFile(TMP, JSON.stringify({ fetchedAt: new Date().toISOString(), through, windowDays: WINDOW_DAYS, pages }));
await rename(TMP, OUT);

const top = Object.entries(pages).sort((a, b) => b[1].views - a[1].views).slice(0, 5);
console.log(`Page views: ${Object.keys(pages).length} films, ${WINDOW_DAYS} days through ${through} → data/raw/pageviews.json`);
for (const [title, p] of top) console.log(`  ${p.views.toLocaleString('en-IN').padStart(10)}  ${title}`);
