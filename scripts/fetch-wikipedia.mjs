// Reads gross / budget / starring / distributor from the "Infobox film" on English Wikipedia for every film
// collected from Wikidata. Uses the free MediaWiki API, 50 articles per request, one request
// at a time. Results are cached so a re-run only refreshes entries older than WIKI_MAX_AGE_DAYS.
// Output: data/raw/wikipedia.json
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getJson, sleep } from './lib/http.mjs';
import { cleanWikitext, getInfoboxField, parseMoney, parseList } from './lib/wikitext.mjs';

// WIKIDATA_IN lets you point at another file, e.g. a partial Wikidata download, to warm the cache.
const IN = process.env.WIKIDATA_IN
  ? pathToFileURL(resolve(process.env.WIKIDATA_IN))
  : new URL('../data/raw/wikidata.json', import.meta.url);
const OUT = new URL('../data/raw/wikipedia.json', import.meta.url);
const TMP = new URL('../data/raw/wikipedia.json.tmp', import.meta.url);
const MAX_REFRESH = Number(process.env.WIKI_MAX_REFRESH || 6000);
// Bump when extract() reads new fields, so older cache entries are re-read first.
const SCHEMA = 2;
const DAY = 86_400_000;
const MAX_AGE_MS = Number(process.env.WIKI_MAX_AGE_DAYS || 6) * DAY;
// Films released in the last ~6 months are still earning, so they are re-read on every run.
const RECENT_MS = 183 * DAY;
const RECENT_MAX_AGE_MS = Number(process.env.WIKI_RECENT_MAX_AGE_HOURS || 3) * 3_600_000;
const BATCH = 50;

async function loadCache() {
  try {
    return JSON.parse(await readFile(OUT, 'utf8')).pages || {};
  } catch {
    return {};
  }
}

function extract(wikitext) {
  const grossRaw = getInfoboxField(wikitext, 'gross');
  const budgetRaw = getInfoboxField(wikitext, 'budget');
  const grossText = cleanWikitext(grossRaw);
  const budgetText = cleanWikitext(budgetRaw);
  return {
    gross: grossText ? { text: grossText.slice(0, 200), ...parseMoney(grossText) } : null,
    budget: budgetText ? { text: budgetText.slice(0, 200), ...parseMoney(budgetText) } : null,
    starring: parseList(getInfoboxField(wikitext, 'starring'), 6),
    country: parseList(getInfoboxField(wikitext, 'country'), 6),
    language: parseList(getInfoboxField(wikitext, 'language'), 6),
    // Tells a cinema release from a streaming premiere (Netflix…) for the upcoming list.
    distributor: parseList(getInfoboxField(wikitext, 'distributor'), 6),
  };
}

async function fetchBatch(titles) {
  const params = new URLSearchParams({
    action: 'query', prop: 'revisions', rvprop: 'content|ids', rvslots: 'main', rvsection: '0',
    redirects: '1', format: 'json', formatversion: '2', maxlag: '5', titles: titles.join('|'),
  });
  for (let attempt = 0; attempt < 5; attempt++) {
    const json = await getJson(`https://en.wikipedia.org/w/api.php?${params}`, {}, { label: 'wikipedia' });
    if (json.error?.code === 'maxlag') {
      await sleep(5000);
      continue;
    }
    if (json.error) throw new Error(`Wikipedia API: ${json.error.info}`);
    // Map each requested title to the page it ended up on (normalised + redirects).
    const finalOf = new Map(titles.map((t) => [t, t]));
    for (const { from, to } of json.query?.normalized || []) {
      for (const [k, v] of finalOf) if (v === from) finalOf.set(k, to);
    }
    for (const { from, to } of json.query?.redirects || []) {
      for (const [k, v] of finalOf) if (v === from) finalOf.set(k, to);
    }
    const byTitle = new Map((json.query?.pages || []).map((p) => [p.title, p]));
    return titles.map((t) => [t, byTitle.get(finalOf.get(t))]);
  }
  throw new Error('Wikipedia API kept reporting maxlag');
}

async function main() {
  const { films } = JSON.parse(await readFile(IN, 'utf8'));
  const cache = await loadCache();
  const now = Date.now();
  const recent = new Set(
    Object.values(films)
      // Any release date counts (dates: every one Wikidata has), so a festival film opening in cinemas soon is recent too.
      .filter((f) => f.enwiki && (f.dates?.length ? f.dates : [f.date]).some((d) => d && now - Date.parse(d) < RECENT_MS && Date.parse(d) < now + 60 * DAY))
      .map((f) => f.enwiki)
  );
  const titles = [...new Set(Object.values(films).map((f) => f.enwiki).filter(Boolean))];
  const current = (t) => cache[t]?.schema === SCHEMA;
  const fetchedAt = (t) => (current(t) ? Date.parse(cache[t].fetchedAt) : 0);
  const stale = titles.filter((t) => {
    if (!current(t)) return true;
    return now - fetchedAt(t) > (recent.has(t) ? RECENT_MAX_AGE_MS : MAX_AGE_MS);
  });
  // Order: never fetched, then recent releases, then the oldest entries. Wikipedia allows about
  // ten of these requests a minute, so old films are refreshed a slice at a time
  // (WIKI_MAX_REFRESH per run) instead of all ~30,000 on the same day.
  stale.sort(
    (a, b) =>
      Number(current(a)) - Number(current(b)) ||
      Number(recent.has(b)) - Number(recent.has(a)) ||
      fetchedAt(a) - fetchedAt(b)
  );
  const todo = stale.filter((t, i) => !current(t) || recent.has(t) || i < MAX_REFRESH);
  console.log(`Wikipedia: ${titles.length} articles, ${stale.length} out of date, reading ${todo.length} now`);

  // Write to a temp file and rename, so a build running at the same time never sees half a file.
  const save = async () => {
    await writeFile(TMP, JSON.stringify({ fetchedAt: new Date().toISOString(), pages: cache }));
    await rename(TMP, OUT);
  };
  let parsed = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    for (const [title, page] of await fetchBatch(batch)) {
      const content = page?.revisions?.[0]?.slots?.main?.content;
      if (!page || page.missing) {
        cache[title] = { schema: SCHEMA, fetchedAt: new Date().toISOString(), missing: true };
        continue;
      }
      if (!content) continue; // response size limit hit; picked up on the next run
      cache[title] = {
        schema: SCHEMA,
        fetchedAt: new Date().toISOString(),
        revid: page.revisions[0].revid,
        ...extract(content),
      };
      if (cache[title].gross?.currency) parsed++;
    }
    process.stdout.write(`  ${Math.min(i + BATCH, todo.length)}/${todo.length} (gross found: ${parsed})\r`);
    if ((i / BATCH) % 20 === 19) await save();
    await sleep(200);
  }
  if (todo.length) await save();
  console.log(`\nSaved → data/raw/wikipedia.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
