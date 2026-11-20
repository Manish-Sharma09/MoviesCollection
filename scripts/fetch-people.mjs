// Real photos of actors and directors, from Wikidata and Wikimedia Commons: free licences, no API key.
//
// 1. For each film, read its cast (P161) and director (P57) statements on Wikidata, keeping people who have
//    an image (P18), and match them to the names the site shows for that film (label or alias). Matching
//    inside a film's own cast avoids mixing up people who share a name.
// 2. People with their own page (3+ films) who were not matched that way are looked up by name on English
//    Wikipedia; the article's Wikidata item is accepted only if it is a human with a film occupation.
// 3. For every photo, Commons gives a thumbnail URL and the photographer and licence, which the site shows
//    as the photo credit (CC BY / CC BY-SA require it).
//
// Results are cached in data/raw/people.json; a run only checks films and people not checked in 45 days.
// Run after scripts/merge.mjs (it reads data/movies.json).
import { readFile, rename, writeFile } from 'node:fs/promises';
import { slugify } from '../src/lib/format.ts';
import { getJson, sleep, sparql } from './lib/http.mjs';

const OUT = new URL('../data/raw/people.json', import.meta.url);
const TMP = new URL('../data/raw/people.json.tmp', import.meta.url);
const DAY = 86_400_000;
const MAX_AGE = Number(process.env.PEOPLE_MAX_AGE_DAYS || 45) * DAY;
const FILM_BATCH = 120;
const PAGE_BATCH = 50;
const now = Date.now();

// Occupations that make a name lookup believable: actor, film/TV/voice/stage actor, film director, director,
// film producer, screenwriter, comedian, playback singer, choreographer, cinematographer, model.
const FILM_OCCUPATIONS = ['Q33999', 'Q10800557', 'Q10798782', 'Q2405480', 'Q2259451', 'Q2526255', 'Q3455803',
  'Q3282637', 'Q28389', 'Q245068', 'Q2643890', 'Q2490358', 'Q222344', 'Q4610556'];

const qid = (uri) => uri.split('/').pop();
const fileOf = (uri) => decodeURIComponent(uri.split('/Special:FilePath/').pop()).replace(/_/g, ' ');

async function load() {
  try {
    return JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    return {};
  }
}

const cache = await load();
cache.films ||= {};   // film QID → when its cast was last read
cache.people ||= {};  // person slug → { name, qid, file, via, checkedAt }
cache.misses ||= {};  // person slug → when a name lookup last found nothing
cache.files ||= {};   // Commons file → { thumb, page, artist, license, licenseUrl, checkedAt }

async function save() {
  cache.fetchedAt = new Date().toISOString();
  await writeFile(TMP, JSON.stringify(cache));
  await rename(TMP, OUT);
}

const { films } = JSON.parse(await readFile(new URL('../data/movies.json', import.meta.url), 'utf8'));

// ---------- 1. cast and directors of each film ----------

const castQuery = (ids) => `
SELECT ?film ?person ?label ?alias ?img WHERE {
  VALUES ?film { ${ids.map((id) => `wd:${id}`).join(' ')} }
  { ?film wdt:P161 ?person } UNION { ?film wdt:P57 ?person }
  ?person wdt:P18 ?img; rdfs:label ?label FILTER(LANG(?label) = "en")
  OPTIONAL { ?person skos:altLabel ?alias FILTER(LANG(?alias) = "en") }
}`;

// Spread re-checks over 34–56 days (by id) so they don't all fall due on the same run; films released in the
// last 90 days are re-checked every 3 days, while their Wikidata cast is still being filled in.
const isRecent = (f) => f.date && now - Date.parse(f.date) >= 0 && now - Date.parse(f.date) < 90 * DAY;
const maxAgeOf = (f) => (isRecent(f) ? 3 * DAY : MAX_AGE * (0.75 + (Number(f.id.slice(1)) % 50) / 100));
const todoFilms = films.filter((f) => !(now - (cache.films[f.id] || 0) < maxAgeOf(f)));
console.log(`People: ${films.length} films, reading the cast of ${todoFilms.length}`);
let matched = 0;
for (let i = 0; i < todoFilms.length; i += FILM_BATCH) {
  const batch = todoFilms.slice(i, i + FILM_BATCH);
  const rows = await sparql(castQuery(batch.map((f) => f.id)), 'people: cast');
  // film → person → { names (slugs), file }
  const byFilm = new Map();
  for (const r of rows) {
    const people = byFilm.get(qid(r.film)) || new Map();
    byFilm.set(qid(r.film), people);
    const p = people.get(qid(r.person)) || { names: new Set(), label: r.label, file: fileOf(r.img) };
    p.names.add(slugify(r.label));
    if (r.alias) p.names.add(slugify(r.alias));
    people.set(qid(r.person), p);
  }
  for (const f of batch) {
    const people = byFilm.get(f.id);
    for (const name of [...f.directors, ...f.starring]) {
      const slug = slugify(name);
      if (!slug || cache.people[slug]?.via === 'cast') continue;
      const hit = people && [...people.entries()].find(([, p]) => p.names.has(slug));
      if (!hit) continue;
      const [person, p] = hit;
      cache.people[slug] = { name, qid: person, file: p.file, via: 'cast', checkedAt: now };
      matched++;
    }
    cache.films[f.id] = now;
  }
  process.stdout.write(`  films ${Math.min(i + FILM_BATCH, todoFilms.length)}/${todoFilms.length}, photos matched ${matched}\r`);
  if ((i / FILM_BATCH) % 10 === 9) await save();
  await sleep(300);
}
console.log();
await save();

// ---------- 2. people with their own page, looked up by name ----------

const credits = new Map(); // slug → { name, films }
for (const f of films) {
  for (const name of [...f.directors, ...f.starring]) {
    const slug = slugify(name);
    if (!slug || slug.length < 3) continue;
    const c = credits.get(slug) || { name, films: 0 };
    c.films++;
    credits.set(slug, c);
  }
}
const lookup = [...credits.entries()]
  .filter(([slug, c]) => c.films >= 3 && !cache.people[slug] && !(now - (cache.misses[slug] || 0) < MAX_AGE))
  .map(([slug, c]) => ({ slug, name: c.name }));
console.log(`People: looking up ${lookup.length} names on Wikipedia`);
let found = 0;
for (let i = 0; i < lookup.length; i += PAGE_BATCH) {
  const batch = lookup.slice(i, i + PAGE_BATCH);
  const params = new URLSearchParams({
    action: 'query', prop: 'pageprops', ppprop: 'wikibase_item|disambiguation', redirects: '1',
    format: 'json', formatversion: '2', maxlag: '5', titles: batch.map((p) => p.name).join('|'),
  });
  const json = await getJson(`https://en.wikipedia.org/w/api.php?${params}`, {}, { label: 'people: wikipedia' });
  if (json.error?.code === 'maxlag') { await sleep(5000); i -= PAGE_BATCH; continue; }
  const finalOf = new Map(batch.map((p) => [p.name, p.name]));
  for (const n of json.query?.normalized || []) finalOf.set(n.from, n.to);
  for (const r of json.query?.redirects || []) for (const [k, v] of finalOf) if (v === r.from) finalOf.set(k, r.to);
  const itemOf = new Map((json.query?.pages || [])
    .filter((p) => !p.missing && p.pageprops?.wikibase_item && !('disambiguation' in p.pageprops))
    .map((p) => [p.title, p.pageprops.wikibase_item]));
  const candidates = batch.map((p) => ({ ...p, item: itemOf.get(finalOf.get(p.name)) })).filter((p) => p.item);
  const ok = new Map();
  if (candidates.length) {
    const rows = await sparql(`
SELECT ?person ?img WHERE {
  VALUES ?person { ${candidates.map((c) => `wd:${c.item}`).join(' ')} }
  VALUES ?occ { ${FILM_OCCUPATIONS.map((o) => `wd:${o}`).join(' ')} }
  ?person wdt:P31 wd:Q5; wdt:P106 ?occ; wdt:P18 ?img.
}`, 'people: check');
    for (const r of rows) if (!ok.has(qid(r.person))) ok.set(qid(r.person), fileOf(r.img));
  }
  for (const p of batch) {
    const c = candidates.find((x) => x.slug === p.slug);
    const file = c && ok.get(c.item);
    if (file) {
      cache.people[p.slug] = { name: p.name, qid: c.item, file, via: 'name', checkedAt: now };
      delete cache.misses[p.slug];
      found++;
    } else {
      cache.misses[p.slug] = now;
    }
  }
  process.stdout.write(`  ${Math.min(i + PAGE_BATCH, lookup.length)}/${lookup.length}, found ${found}\r`);
  if ((i / PAGE_BATCH) % 10 === 9) await save();
  await sleep(300);
}
console.log();
await save();

// ---------- 3. thumbnails and credits from Commons ----------

const stripHtml = (html) => String(html || '')
  .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

const files = [...new Set(Object.values(cache.people).map((p) => p.file))]
  .filter((f) => !(now - (cache.files[f]?.checkedAt || 0) < MAX_AGE));
console.log(`People: reading ${files.length} photos from Commons`);
for (let i = 0; i < files.length; i += PAGE_BATCH) {
  const batch = files.slice(i, i + PAGE_BATCH);
  const params = new URLSearchParams({
    action: 'query', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '330',
    iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|AttributionRequired',
    format: 'json', formatversion: '2', maxlag: '5', titles: batch.map((f) => `File:${f}`).join('|'),
  });
  const json = await getJson(`https://commons.wikimedia.org/w/api.php?${params}`, {}, { label: 'people: commons' });
  if (json.error?.code === 'maxlag') { await sleep(5000); i -= PAGE_BATCH; continue; }
  const fromTitle = new Map(batch.map((f) => [`File:${f}`, f]));
  for (const n of json.query?.normalized || []) if (fromTitle.has(n.from)) fromTitle.set(n.to, fromTitle.get(n.from));
  for (const page of json.query?.pages || []) {
    const file = fromTitle.get(page.title);
    const info = page.imageinfo?.[0];
    if (!file) continue;
    if (!info?.thumburl) { cache.files[file] = { missing: true, checkedAt: now }; continue; }
    const meta = info.extmetadata || {};
    cache.files[file] = {
      thumb: info.thumburl,
      page: info.descriptionurl,
      artist: stripHtml(meta.Artist?.value) || null,
      license: stripHtml(meta.LicenseShortName?.value) || null,
      licenseUrl: meta.LicenseUrl?.value || null,
      checkedAt: now,
    };
  }
  process.stdout.write(`  ${Math.min(i + PAGE_BATCH, files.length)}/${files.length}\r`);
  if ((i / PAGE_BATCH) % 10 === 9) await save();
  await sleep(300);
}
console.log();
await save();

const usable = Object.values(cache.people).filter((p) => cache.files[p.file]?.thumb).length;
console.log(`People: ${usable} people with a photo (${Object.values(cache.people).filter((p) => p.via === 'cast').length} from film casts, ${Object.values(cache.people).filter((p) => p.via === 'name').length} by name) → data/raw/people.json`);
