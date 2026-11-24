// Day-by-day totals for films in cinemas, rebuilt from each Wikipedia article's edit history:
// the infobox gross as it stood at the end of every day (India time). Old revisions never change,
// so parsed revisions are cached and each run only reads the newest ones.
// Output: data/raw/history.json
import { readFile, writeFile, rename } from 'node:fs/promises';
import { getJson, sleep } from './lib/http.mjs';
import { cleanWikitext, getInfoboxField, parseMoney } from './lib/wikitext.mjs';

const WD = new URL('../data/raw/wikidata.json', import.meta.url);
const WP = new URL('../data/raw/wikipedia.json', import.meta.url);
const OUT = new URL('../data/raw/history.json', import.meta.url);
const TMP = new URL('../data/raw/history.json.tmp', import.meta.url);

const DAY = 86_400_000;
const IST_OFFSET = 5.5 * 3_600_000;
const WINDOW_DAYS = Number(process.env.HISTORY_DAYS || 90);
const MAX_FILMS = Number(process.env.HISTORY_MAX_FILMS || 60);
const API = 'https://en.wikipedia.org/w/api.php';

/** Wikidata's earliest date, or, when that is only a year (YYYY-01-01), the earliest date that year known to the day. */
const dayDate = (f) => (f.date?.endsWith('-01-01') && f.dates?.some((d) => d.startsWith(f.date.slice(0, 4)))
  ? f.dates.filter((d) => d.startsWith(f.date.slice(0, 4))).sort()[0] : f.date);
const istDate = (iso) => new Date(Date.parse(iso) + IST_OFFSET).toISOString().slice(0, 10);
const api = (params) =>
  getJson(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params })}`, {}, { label: 'wikipedia history' });

/** Newest revision of each India-time day since `since`, as [date, revid, timestamp]. */
async function dailyRevisions(title, since) {
  const perDay = new Map();
  let cont = {};
  for (let page = 0; page < 6; page++) {
    const json = await api({
      action: 'query', prop: 'revisions', titles: title, redirects: '1',
      rvprop: 'ids|timestamp', rvlimit: '500', rvend: `${since}T00:00:00Z`, ...cont,
    });
    for (const r of json.query?.pages?.[0]?.revisions || []) {
      const day = istDate(r.timestamp);
      if (!perDay.has(day)) perDay.set(day, [day, r.revid, r.timestamp]); // newest first
    }
    if (!json.continue?.rvcontinue) break;
    cont = { rvcontinue: json.continue.rvcontinue };
    await sleep(300);
  }
  return [...perDay.values()].sort((a, b) => a[0].localeCompare(b[0]));
}

/** Parse the infobox gross of many revisions (50 per request). Returns {revid: [currency, low, high] | 0}. */
async function parseRevisions(revids) {
  const out = {};
  for (let i = 0; i < revids.length; i += 50) {
    const batch = revids.slice(i, i + 50);
    const json = await api({
      action: 'query', prop: 'revisions', revids: batch.join('|'),
      rvprop: 'ids|content', rvslots: 'main', rvsection: '0',
    });
    for (const page of json.query?.pages || []) {
      for (const rev of page.revisions || []) {
        const text = rev.slots?.main?.content;
        const m = text ? parseMoney(cleanWikitext(getInfoboxField(text, 'gross'))) : null;
        out[rev.revid] = m?.currency ? [m.currency, m.low, m.high] : 0;
      }
    }
    for (const id of batch) if (!(id in out)) out[id] = 0; // deleted/hidden revision
    process.stdout.write(`  parsed ${Math.min(i + 50, revids.length)}/${revids.length} revisions\r`);
    await sleep(300);
  }
  return out;
}

async function main() {
  const { films } = JSON.parse(await readFile(WD, 'utf8'));
  const wp = await readFile(WP, 'utf8').then((t) => JSON.parse(t).pages).catch(() => ({}));
  const cache = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => ({ films: {}, revs: {} }));
  const now = Date.now();

  // Films released in the window (exact dates only) that have, or may have, a gross figure. When Wikidata's
  // earliest date is only a year (YYYY-01-01), the earliest date it has to the day is used instead.
  const recent = Object.values(films)
    .map((f) => ({ ...f, date: dayDate(f) }))
    .filter((f) => f.enwiki && f.date && !f.date.endsWith('-01-01'))
    .filter((f) => {
      const age = now - Date.parse(`${f.date}T00:00:00Z`);
      return age >= 0 && age < WINDOW_DAYS * DAY;
    })
    .filter((f) => !wp[f.enwiki] || wp[f.enwiki].gross?.currency)
    .sort((a, b) => (wp[b.enwiki]?.gross?.low || 0) - (wp[a.enwiki]?.gross?.low || 0))
    .slice(0, MAX_FILMS);
  console.log(`History: ${recent.length} films released in the last ${WINDOW_DAYS} days`);

  const kept = {};
  const need = new Set();
  for (const [i, f] of recent.entries()) {
    const since = new Date(Date.parse(`${f.date}T00:00:00Z`) - 2 * DAY).toISOString().slice(0, 10);
    const days = await dailyRevisions(f.enwiki, since);
    kept[f.enwiki] = { release: f.date, checkedAt: new Date().toISOString(), days };
    for (const [, revid] of days) if (!(revid in cache.revs)) need.add(revid);
    process.stdout.write(`  listed ${i + 1}/${recent.length} articles\r`);
    await sleep(300);
  }
  console.log(`\n  ${need.size} new daily revisions to read`);
  const parsed = await parseRevisions([...need]);

  // Keep only revisions still referenced, so the cache doesn't grow forever.
  const revs = {};
  for (const film of Object.values(kept)) {
    for (const [, revid] of film.days) revs[revid] = parsed[revid] ?? cache.revs[revid] ?? 0;
  }
  await writeFile(TMP, JSON.stringify({ fetchedAt: new Date().toISOString(), films: kept, revs }));
  await rename(TMP, OUT);
  console.log(`\nSaved history for ${Object.keys(kept).length} films → data/raw/history.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
