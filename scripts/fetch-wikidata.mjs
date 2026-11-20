// Pulls film metadata, box office and budget statements from Wikidata (CC0, free, no key).
// Output: data/raw/wikidata.json
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { sparql, sleep } from './lib/http.mjs';

const OUT = new URL('../data/raw/wikidata.json', import.meta.url);
const PARTIAL = new URL('../data/raw/wikidata.partial.json', import.meta.url);
const BATCH = 250;
const DAY = 86_400_000;
const META_MAX_AGE_MS = Number(process.env.WIKIDATA_META_MAX_AGE_DAYS || 7) * DAY;
const RECENT_MS = 183 * DAY;

// Item types that are actually films (excludes concert tours, telethons, festivals…).
const FILM_TYPES = 'wd:Q11424 wd:Q202866 wd:Q20650540 wd:Q31235 wd:Q104840802 wd:Q24869 wd:Q29168811';

// Countries whose films we also collect (via their Wikipedia infobox) even when Wikidata has
// no box office figure. Wikidata is very thin for Indian cinema. ISO alpha-2 → Wikidata item.
const EXTRA_COUNTRIES = { IN: 'Q668' };

const qid = (uri) => uri?.split('/').pop();

function statementQuery(prop) {
  return `
SELECT ?film ?st ?amount ?iso ?unit ?place ?date WHERE {
  VALUES ?type { ${FILM_TYPES} }
  ?film wdt:P31 ?type; wdt:P2142 [] ; p:${prop} ?st.
  ?st psv:${prop} ?v; wikibase:rank ?rank.
  FILTER(?rank != wikibase:DeprecatedRank)
  ?v wikibase:quantityAmount ?amount; wikibase:quantityUnit ?unit.
  OPTIONAL { ?unit wdt:P498 ?iso }
  OPTIONAL { ?st pq:P3005 ?place }
  OPTIONAL { ?st pq:P585 ?date }
}`;
}

// One row per (film, field, value). UNION instead of many OPTIONALs avoids cross products,
// which is what makes the Wikidata Query Service time out.
function metadataQuery(ids) {
  return `
SELECT ?film ?k ?v WHERE {
  VALUES ?film { ${ids.map((id) => `wd:${id}`).join(' ')} }
  {
    ?film rdfs:label ?v FILTER(LANG(?v) = "en") BIND("label" AS ?k)
  } UNION {
    ?wp schema:about ?film; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?v BIND("enwiki" AS ?k)
  } UNION {
    ?film wdt:P577 ?d BIND(STR(?d) AS ?v) BIND("date" AS ?k)
  } UNION {
    ?film wdt:P495/wdt:P297 ?v BIND("country" AS ?k)
  } UNION {
    ?film wdt:P364 ?l. ?l rdfs:label ?v FILTER(LANG(?v) = "en") BIND("language" AS ?k)
  } UNION {
    ?film wdt:P57 ?dr. ?dr rdfs:label ?v FILTER(LANG(?v) = "en") BIND("director" AS ?k)
  } UNION {
    ?film wdt:P345 ?v BIND("imdb" AS ?k)
  } UNION {
    ?film wdt:P4947 ?v BIND("tmdb" AS ?k)
  } UNION {
    ?film wdt:P2047 ?rt BIND(STR(?rt) AS ?v) BIND("runtime" AS ?k)
  }
}`;
}

function toStatements(rows) {
  const seen = new Set();
  const out = {};
  for (const r of rows) {
    if (seen.has(r.st)) continue;
    seen.add(r.st);
    (out[qid(r.film)] ||= []).push({
      amount: Number(r.amount),
      currency: r.iso || null,
      unit: qid(r.unit),
      place: qid(r.place) || null,
      date: r.date ? r.date.slice(0, 10) : null,
    });
  }
  return out;
}

function emptyFilm(id) {
  return {
    qid: id, label: null, enwiki: null, date: null, countries: [], languages: [],
    directors: [], imdb: null, tmdb: null, runtime: null,
  };
}

function applyMetadata(films, rows) {
  for (const { film, k, v } of rows) {
    const f = films[qid(film)];
    if (!f || !v) continue;
    switch (k) {
      case 'date': {
        const d = v.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (!f.date || d < f.date)) f.date = d;
        break;
      }
      case 'country': if (!f.countries.includes(v)) f.countries.push(v); break;
      case 'language': if (!f.languages.includes(v)) f.languages.push(v); break;
      case 'director': if (!f.directors.includes(v)) f.directors.push(v); break;
      case 'runtime': f.runtime ??= Math.round(Number(v)); break;
      default: f[k] ??= v;
    }
  }
}

async function main() {
  console.log('Wikidata: box office statements…');
  const boxOffice = toStatements(await sparql(statementQuery('P2142'), 'box office'));
  console.log(`  ${Object.keys(boxOffice).length} films with box office`);
  await sleep(1000);

  console.log('Wikidata: budget statements…');
  const budget = toStatements(await sparql(statementQuery('P2130'), 'budget'));
  await sleep(1000);

  const films = {};
  for (const id of Object.keys(boxOffice)) films[id] = emptyFilm(id);

  for (const [cc, countryQid] of Object.entries(EXTRA_COUNTRIES)) {
    console.log(`Wikidata: films from ${cc} with an English Wikipedia article…`);
    const rows = await sparql(
      `SELECT DISTINCT ?film WHERE {
        ?film wdt:P31 wd:Q11424; wdt:P495 wd:${countryQid}.
        ?wp schema:about ?film; schema:isPartOf <https://en.wikipedia.org/>.
      }`,
      `${cc} films`
    );
    let added = 0;
    for (const r of rows) {
      const id = qid(r.film);
      if (!films[id]) { films[id] = emptyFilm(id); added++; }
    }
    console.log(`  +${added} films`);
    await sleep(1000);
  }

  // Resume from a previous run that stopped half way (metadata is the slow part).
  await mkdir(new URL('../data/raw/', import.meta.url), { recursive: true });
  const partial = await readFile(PARTIAL, 'utf8').then(JSON.parse).catch(() => ({ films: {} }));
  for (const [id, f] of Object.entries(partial.films)) if (films[id]) films[id] = f;
  const done = new Set(Object.keys(partial.films).filter((id) => films[id]));

  // Reuse metadata from the last full run (titles, directors… rarely change). Films released in
  // the last ~6 months are always refreshed because their Wikidata entries are still filling in.
  const now = Date.now();
  const previous = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => null);
  for (const [id, f] of Object.entries(previous?.films || {})) {
    if (!films[id] || done.has(id)) continue;
    const age = now - Date.parse(f.metaAt || previous.fetchedAt);
    const recent = f.date && now - Date.parse(f.date) < RECENT_MS;
    if (age < META_MAX_AGE_MS && !recent) {
      films[id] = f;
      done.add(id);
    }
  }

  const ids = Object.keys(films).filter((id) => !done.has(id));
  console.log(`Wikidata: metadata for ${ids.length} films (${done.size} reused) in batches of ${BATCH}…`);
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    applyMetadata(films, await sparql(metadataQuery(batch), `metadata ${i}`));
    const at = new Date().toISOString();
    batch.forEach((id) => { films[id].metaAt = at; done.add(id); });
    process.stdout.write(`  ${Math.min(i + BATCH, ids.length)}/${ids.length}\r`);
    if ((i / BATCH) % 10 === 9) {
      const snapshot = Object.fromEntries([...done].map((id) => [id, films[id]]));
      await writeFile(PARTIAL, JSON.stringify({ films: snapshot }));
    }
    await sleep(1500); // the query service allows ~60s of query time per minute per client
  }
  console.log();

  await writeFile(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), films, boxOffice, budget }));
  await rm(PARTIAL, { force: true });
  console.log(`Saved ${Object.keys(films).length} films → data/raw/wikidata.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
