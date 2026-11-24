// India net, India gross and overseas totals for Indian films, read from the "Box office" section of each
// film's English Wikipedia article (scripts/lib/boxoffice-text.mjs). The infobox (scripts/fetch-wikipedia.mjs)
// only has the worldwide gross; these power the Worldwide / Overseas / India net switch on film pages.
// src/lib/data.ts cross-checks every figure against the worldwide gross before it is shown.
//
// It also reads the advance booking (ticket pre-sales) amount an article reports, for upcoming films and films
// released in the last 14 days, from any country (advanceFigure, shown on upcoming film pages).
//
// Films: Indian films that grossed ₹50 crore or more, every Indian film released in the last 180 days, upcoming
// films and films released in the last 14 days. Cached in data/raw/boxoffice.json by article title: upcoming films
// and those released in the last 120 days are re-read when older than 6 hours, the rest monthly.
// Run after scripts/merge.mjs (it reads data/movies.json).
import { readFile, rename, writeFile } from 'node:fs/promises';
import { advanceFigure, boxOfficeSection, marketFigures } from './lib/boxoffice-text.mjs';
import { getJson, sleep } from './lib/http.mjs';

const OUT = new URL('../data/raw/boxoffice.json', import.meta.url);
const TMP = new URL('../data/raw/boxoffice.json.tmp', import.meta.url);
const DAY = 86_400_000;
const BATCH = 20; // whole articles are large; 20 per request keeps responses around a few MB
const now = Date.now();

const cache = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => ({}));
cache.pages ||= {};
const save = async () => {
  cache.fetchedAt = new Date().toISOString();
  await writeFile(TMP, JSON.stringify(cache));
  await rename(TMP, OUT);
};

const { films, upcoming = [] } = JSON.parse(await readFile(new URL('../data/movies.json', import.meta.url), 'utf8'));
const age = (f) => (f.date ? now - Date.parse(f.date) : Infinity);
const indian = films.filter((f) => f.indian && f.enwiki && (f.gross.inr >= 50e7 || age(f) < 180 * DAY));
const justOut = films.filter((f) => f.enwiki && !f.indian && age(f) >= 0 && age(f) < 14 * DAY);
const coming = upcoming.filter((f) => f.enwiki);
const wanted = [...indian, ...justOut, ...coming];
const due = wanted.filter((f) => {
  const entry = cache.pages[f.enwiki];
  const maxAge = !f.gross || age(f) < 120 * DAY ? 6 * 3_600_000 : 30 * DAY;
  return !entry || now - entry.checkedAt > maxAge || !('advance' in entry);
});
const titles = [...new Set(due.map((f) => f.enwiki))];
console.log(`Box office text: ${indian.length} Indian films, ${justOut.length} new international releases, ${coming.length} upcoming; reading ${titles.length} articles from Wikipedia`);

let withFigures = 0;
let withAdvance = 0;
for (let i = 0; i < titles.length; i += BATCH) {
  const batch = titles.slice(i, i + BATCH);
  const params = new URLSearchParams({
    action: 'query', prop: 'revisions', rvprop: 'content|ids', rvslots: 'main', titles: batch.join('|'),
    redirects: '1', format: 'json', formatversion: '2', maxlag: '5',
  });
  const json = await getJson(`https://en.wikipedia.org/w/api.php?${params}`, {}, { label: 'wikipedia box office' });
  // Requested titles may have been redirected or normalised; map each answer back to the title we asked for.
  const back = new Map();
  for (const n of json.query?.normalized || []) back.set(n.to, n.from);
  for (const r of json.query?.redirects || []) back.set(r.to, back.get(r.from) ?? r.from);
  for (const page of json.query?.pages || []) {
    const asked = back.get(page.title) ?? page.title;
    const rev = page.revisions?.[0];
    const text = rev?.slots?.main?.content;
    const section = text ? boxOfficeSection(text) : null;
    const figures = section ? marketFigures(section) : {};
    const advance = text ? advanceFigure(text) : null;
    if (Object.keys(figures).length) withFigures++;
    if (advance) withAdvance++;
    cache.pages[asked] = { checkedAt: now, revid: rev?.revid ?? null, ...figures, advance };
  }
  await save();
  if (i + BATCH < titles.length) await sleep(1500);
}
console.log(`Box office text: market figures in ${withFigures}, advance booking in ${withAdvance} of ${titles.length} articles read.`);
