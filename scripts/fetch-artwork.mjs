// Posters and backdrops for every film, and photos of cast and directors, from TMDB.
//
// Needs a free TMDB "API Read Access Token" in TMDB_READ_TOKEN: in the shell, in a local .env.local file
// (TMDB_READ_TOKEN=…, never committed), or as a GitHub Actions secret. Without it the site uses the bundled
// starter posters plus whatever is already cached.
//
// - Each run reads up to TMDB_MAX_PER_RUN films (default 2,500), most visible first: films in cinemas, this
//   year's biggest, the all-time and Indian charts, then everything else by gross. A film is re-read after
//   30 days (2 days while it is in cinemas, when posters are still being added).
// - Films without a TMDB id on Wikidata are found by title and year (TMDB search).
// - The same request returns the film's credits, which give photos of its main cast and its directors
//   (used where Wikimedia Commons has no free photo; see scripts/fetch-people.mjs).
//
// Caches: data/raw/artwork.json (film art, and "qid:<id>" → found TMDB id), data/raw/tmdb-people.json.
import { readFile, rename, writeFile } from 'node:fs/promises';
import { slugify } from '../src/lib/format.ts';

const token = process.env.TMDB_READ_TOKEN?.trim();
if (!token) {
  console.log('Artwork: using bundled and cached posters (TMDB_READ_TOKEN is unset; see README "Movie artwork").');
  process.exit(0);
}

const DAY = 86_400_000;
const now = Date.now();
const MAX_PER_RUN = Number(process.env.TMDB_MAX_PER_RUN || 2500);
const SEARCH_PER_RUN = Number(process.env.TMDB_SEARCH_PER_RUN || 300);
const CONCURRENCY = 6;
const REFRESH = 30 * DAY;
const RECENT_REFRESH = 2 * DAY;
const CAST_PHOTOS = 10; // top-billed cast members whose photos are kept

const fromProject = (path) => new URL(`../${path}`, import.meta.url);
const read = async (path, fallback) => JSON.parse(await readFile(fromProject(path), 'utf8').catch((error) => {
  if (error.code === 'ENOENT' && fallback !== undefined) return JSON.stringify(fallback);
  throw error;
}));
const save = async (path, value) => {
  const temp = fromProject(`${path}.tmp`);
  await writeFile(temp, JSON.stringify(value));
  await rename(temp, fromProject(path));
};

const { films } = await read('data/movies.json');
const art = await read('data/raw/artwork.json', {});
const people = await read('data/raw/tmdb-people.json', {});

let stopped = false;
const api = async (path) => {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`https://api.themoviedb.org/3${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (response?.ok) return response.json();
    if (response && [401, 403].includes(response.status)) {
      stopped = true;
      throw new Error('TMDB rejected the token (check TMDB_READ_TOKEN).');
    }
    if (response?.status === 404) return null;
    if (attempt >= 3) return undefined; // give up on this one for now; it is retried next run
    await new Promise((r) => setTimeout(r, (Number(response?.headers.get('retry-after')) || 2 ** attempt) * 1000));
  }
};

// Runs jobs a few at a time, stopping early if TMDB rejects the token.
async function pool(items, job) {
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length && !stopped) {
      const item = items[next++];
      await job(item);
      if (++done % 100 === 0) process.stdout.write(`  ${done}/${items.length}\r`);
    }
  }));
}

const isRecent = (f) => f.date && !f.date.endsWith('-01-01') && now - Date.parse(f.date) >= 0 && now - Date.parse(f.date) < 90 * DAY;
const year = new Date().getUTCFullYear();
const ordered = [...new Set([
  ...films.filter(isRecent),
  ...films.filter((f) => f.year === year).slice(0, 75),
  ...films.slice(0, 200),
  ...films.filter((f) => f.indian).slice(0, 200),
  ...films,
])];

try {
  // 1. Find films that have no TMDB id on Wikidata.
  const searches = ordered
    .filter((f) => !f.tmdb && f.year && !(now - (art[`qid:${f.id}`]?.checkedAt || 0) < REFRESH))
    .slice(0, SEARCH_PER_RUN);
  let foundIds = 0;
  await pool(searches, async (f) => {
    const q = new URLSearchParams({ query: f.title, year: String(f.year), include_adult: 'false' });
    const result = await api(`/search/movie?${q}`);
    if (result === undefined) return;
    const hit = (result?.results || []).find((m) => Math.abs(Number(m.release_date?.slice(0, 4)) - f.year) <= 1);
    art[`qid:${f.id}`] = { tmdb: hit ? String(hit.id) : null, checkedAt: now };
    if (hit) foundIds++;
  });
  if (searches.length) console.log(`Artwork: searched ${searches.length} films without a TMDB id, found ${foundIds}.`);

  // 2. Posters, backdrops and credits.
  const idOf = (f) => f.tmdb || art[`qid:${f.id}`]?.tmdb || null;
  const due = ordered.filter((f) => {
    const id = idOf(f);
    if (!id || !/^\d+$/.test(id)) return false;
    const checked = art[id]?.checkedAt || 0;
    return now - checked > (isRecent(f) ? RECENT_REFRESH : REFRESH);
  }).slice(0, MAX_PER_RUN);
  let updated = 0;
  await pool(due, async (f) => {
    const id = idOf(f);
    const movie = await api(`/movie/${id}?append_to_response=credits`);
    if (movie === undefined) return;
    if (movie === null) { art[id] = { ...art[id], checkedAt: now }; return; }
    art[id] = { poster: movie.poster_path, backdrop: movie.backdrop_path, checkedAt: now };
    updated++;
    const cast = (movie.credits?.cast || []).filter((c) => c.order < CAST_PHOTOS);
    const directors = (movie.credits?.crew || []).filter((c) => c.job === 'Director');
    for (const person of [...cast, ...directors]) {
      const slug = slugify(person.name);
      if (slug && person.profile_path) people[slug] = { name: person.name, id: person.id, profile: person.profile_path, checkedAt: now };
    }
  });
  console.log(`Artwork: refreshed ${updated} of ${due.length} queued films; ${Object.keys(people).length} people with a TMDB photo.`);
} catch (error) {
  console.warn(`::warning::Artwork refresh stopped: ${error.message}`);
} finally {
  await save('data/raw/artwork.json', art);
  await save('data/raw/tmdb-people.json', people);
}
