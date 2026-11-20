// Everything the pages need, computed once per build worker from data/movies.json
// (written by scripts/merge.mjs). Server-only: never import this from a client component.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hindiLanguageName, slugify, type Currency } from './format';
import { CONTACT_EMAIL, GA_ID, SITE } from './site';
import type {
  ChartFilm, CinemaBoard, CinemaEntry, Club, ClubSlug, DailyRow, Film, Language, MoviesFile, Person, RankItem, Stats,
} from './types';
import { readChartSync } from './worldwide-chart';

const readJson = <T>(file: string, fallback?: T): T => {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), file), 'utf8')) as T;
  } catch (error) {
    if (fallback !== undefined && (error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw error;
  }
};

const data = readJson<MoviesFile>('data/movies.json');

/** Every film, sorted by worldwide gross, biggest first. */
export const films: Film[] = data.films;
export const RATE = data.rates;
/** When Wikipedia was last read (ISO time), shown on the home page. */
export const sourcesCheckedAt: string | null = data.sources?.wikipedia ?? null;

export const NOW_YEAR = new Date().getUTCFullYear();
const DAY_MS = 86_400_000;
const TODAY = Date.now();
/** When this build ran; the live page computes its first (static) render at this moment. */
export const BUILD_TIME = TODAY;

// ---------- artwork (TMDB paths, bundled starter set + cache filled by scripts/fetch-artwork.mjs) ----------

type Art = { poster?: string | null; backdrop?: string | null; tmdb?: string | null };
const featuredArt = readJson<Record<string, Art>>('data/featured-art.json', {});
const fetchedArt = readJson<Record<string, Art>>('data/raw/artwork.json', {});
// Per film, keep whichever source has the picture (a fetched entry without a poster must not hide a bundled one).
const artwork: Record<string, Art> = { ...featuredArt };
for (const [id, a] of Object.entries(fetchedArt)) {
  artwork[id] = { poster: a.poster || featuredArt[id]?.poster, backdrop: a.backdrop || featuredArt[id]?.backdrop, tmdb: a.tmdb };
}

// Wikimedia serves images from upload.wikimedia.org and (newer) thumb.wikimedia.org; the API adds tracking
// parameters, which are dropped so every page uses one clean, cacheable address per image.
const WIKIMEDIA = /^https:\/\/(upload|thumb)\.wikimedia\.org\//;
const clean = (url: string) => url.split('?')[0];

/**
 * A Wikimedia image at a standard width. Thumbnails can only shrink: at or above the original width the
 * original is used. An original file URL (…/wikipedia/en/0/0d/Name.jpg) becomes …/thumb/0/0d/Name.jpg/120px-Name.jpg.
 */
function wikimediaAt(url: string, originalWidth: number | undefined, px: number): string {
  const u = clean(url);
  if (originalWidth && originalWidth <= px) return u;
  const thumb = u.match(/^(.*\/thumb\/.*\/)\d+px-([^/]+)$/);
  if (thumb) return `${thumb[1]}${px}px-${thumb[2]}`;
  const original = u.match(/^(https:\/\/[^/]+\/wikipedia\/[^/]+\/)([0-9a-f]\/[0-9a-f]{2}\/)([^/]+)$/);
  return original && originalWidth ? `${original[1]}thumb/${original[2]}${original[3]}/${px}px-${original[3]}` : u;
}

// Free posters from each film's Wikipedia infobox (scripts/fetch-posters.mjs), by film id.
type WikiPoster = { thumb?: string; width?: number; original?: string };
const wikiPages = readJson<{ pages?: Record<string, WikiPoster> }>('data/raw/posters.json', {}).pages || {};
const wikiPosterById = new Map<string, WikiPoster>();
for (const f of films) {
  const p = f.enwiki ? wikiPages[f.enwiki] : undefined;
  if (p?.thumb && WIKIMEDIA.test(p.thumb)) wikiPosterById.set(f.id, p);
}
const wikiPosterUrl = (p: WikiPoster, px: number) => wikimediaAt(p.original || p.thumb!, p.width, px);

const TMDB_PATH = /^\/[\w.-]+\.(jpg|png|webp)$/i;
export type ArtSize = 'w92' | 'w342' | 'w500' | 'w1280';
const WIKI_WIDTH: Record<ArtSize, number> = { w92: 120, w342: 330, w500: 500, w1280: 960 };

/**
 * A film's poster or backdrop: TMDB art when there is some (the bundled starter set, or fetched with an
 * optional token), otherwise the poster from its Wikipedia article. Backdrops come from TMDB only.
 */
export function artUrl(f: { tmdb?: string | null; id?: string }, kind: 'poster' | 'backdrop', size: ArtSize): string {
  const tmdb = f.tmdb || (f.id ? artwork[`qid:${f.id}`]?.tmdb : null);
  const path = tmdb ? artwork[tmdb]?.[kind] : undefined;
  if (typeof path === 'string' && TMDB_PATH.test(path)) return `https://image.tmdb.org/t/p/${size}${path}`;
  const wiki = kind === 'poster' && f.id ? wikiPosterById.get(f.id) : undefined;
  return wiki ? wikiPosterUrl(wiki, WIKI_WIDTH[size]) : '';
}

// ---------- photos of people ----------
// Wikimedia Commons first (free licences; shown with the photographer's credit), then TMDB profiles.

interface CommonsFile { thumb?: string; page?: string; artist?: string | null; license?: string | null; licenseUrl?: string | null }
const commons = readJson<{ people?: Record<string, { file: string }>; files?: Record<string, CommonsFile> }>('data/raw/people.json', {});
const tmdbPeople = readJson<Record<string, { profile?: string }>>('data/raw/tmdb-people.json', {});

export interface Photo {
  url: string;
  /** Commons photos carry their credit; TMDB photos are covered by the TMDB notice in the footer. */
  credit: { artist: string | null; license: string | null; licenseUrl: string | null; page: string } | null;
}

/**
 * Commons thumbnail address, worked out from the file name the way MediaWiki stores files (MD5 of the
 * name picks the folder), for photos whose details have not been read from the Commons API yet.
 * Only for plain image formats; anything unusual waits for the API's own thumbnail address.
 */
function commonsThumb(file: string, width = 330): string | null {
  if (!/\.(jpe?g|png|webp|gif)$/i.test(file)) return null;
  const name = file.replace(/ /g, '_');
  const hash = createHash('md5').update(name).digest('hex');
  const encoded = encodeURIComponent(name);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${hash[0]}/${hash.slice(0, 2)}/${encoded}/${width}px-${encoded}`;
}

export function photoFor(name: string): Photo | null {
  const slug = slugify(name);
  const file = commons.people?.[slug]?.file;
  const c = file ? commons.files?.[file] : undefined;
  if (c?.thumb && c.page && WIKIMEDIA.test(c.thumb)) {
    return { url: clean(c.thumb), credit: { artist: c.artist ?? null, license: c.license ?? null, licenseUrl: c.licenseUrl ?? null, page: c.page } };
  }
  // Details not read yet (or the file has been removed): use the derived thumbnail and credit its Commons page.
  const derived = file && !c?.thumb && !(c as { missing?: boolean } | undefined)?.missing ? commonsThumb(file) : null;
  if (derived) {
    const page = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file!.replace(/ /g, '_'))}`;
    return { url: derived, credit: { artist: null, license: null, licenseUrl: null, page } };
  }
  const profile = tmdbPeople[slug]?.profile;
  if (profile && TMDB_PATH.test(profile)) return { url: `https://image.tmdb.org/t/p/w185${profile}`, credit: null };
  return null;
}

// ---------- worldwide lifetime chart (Box Office Mojo top 200) ----------

export const MOJO_URL = 'https://www.boxofficemojo.com/chart/top_lifetime_gross/?area=XWW';
export const chart = readChartSync();

const worldwideKey = (title: string, year: number | null) =>
  `${slugify(title.replace(/^Star Wars: Episode [IVX]+ - /, 'Star Wars: '))}-${year}`;
// Chart rows are matched to catalog films by title and year; ambiguous titles stay unmatched.
const catalogByTitle = new Map<string, Film | null>();
for (const film of films) {
  const key = worldwideKey(film.title, film.year);
  catalogByTitle.set(key, catalogByTitle.has(key) ? null : film);
}
export const worldwide: ChartFilm[] = chart.films.map(([title, year, usd], i) => {
  const film = catalogByTitle.get(worldwideKey(title, year));
  return {
    id: film?.id, slug: film?.slug, tmdb: film?.tmdb, title, year, rank: i + 1,
    gross: { usd, inr: Math.round(usd * RATE.inrPerUsd) },
  };
});
export const worldwideById = new Map(worldwide.filter((f) => f.id).map((f) => [f.id!, f]));

// ---------- indexes ----------

export const isIndian = (f: Film) => f.indian;
export const nativeOf = (f: { indian?: boolean }): Currency => (f.indian ? 'INR' : 'USD');

function groupBy<K, T>(list: T[], keysOf: (item: T) => K | K[] | null | undefined): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of list) {
    const keys = ([] as (K | null | undefined)[]).concat(keysOf(item));
    for (const key of keys) {
      if (key === null || key === undefined || key === '') continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
  }
  return map;
}

export const filmBySlug = new Map(films.map((f) => [f.slug, f]));
export const indian = films.filter(isIndian);
export const byYear = groupBy(films, (f) => f.year);
export const yearsSorted = [...byYear.keys()].sort((a, b) => b - a);

const byLanguage = groupBy(films, (f) => f.languages);
/** Languages with 5+ films get a page, biggest first. */
export const languages: Language[] = [...byLanguage.entries()]
  .filter(([, list]) => list.length >= 5)
  .map(([name, list]) => ({
    name, hi: hindiLanguageName(name), slug: slugify(name), list,
    native: (list.filter(isIndian).length > list.length / 2 ? 'INR' : 'USD') as Currency,
  }))
  .sort((a, b) => b.list.length - a.list.length);
export const languageByName = new Map(languages.map((l) => [l.name, l]));
export const languageBySlug = new Map(languages.map((l) => [l.slug, l]));

// People: directors (Wikidata) and stars (Wikipedia infobox). Pages only for 3+ films.
const peopleMap = new Map<string, { name: string; slug: string; films: Map<string, Film>; roles: Person['roles'] }>();
for (const f of films) {
  const roles = [...f.directors.map((n) => [n, 'director'] as const), ...f.starring.map((n) => [n, 'actor'] as const)];
  for (const [name, role] of roles) {
    const slug = slugify(name);
    if (!slug || slug.length < 3) continue;
    if (!peopleMap.has(slug)) peopleMap.set(slug, { name, slug, films: new Map(), roles: new Set() });
    const p = peopleMap.get(slug)!;
    p.films.set(f.id, f);
    p.roles.add(role);
  }
}
export const people = new Map<string, Person>(
  [...peopleMap.values()]
    .filter((p) => p.films.size >= 3)
    .map((p) => [p.slug, { ...p, films: [...p.films.values()].sort((a, b) => b.gross.usd - a.gross.usd) }])
);

export const CLUBS: Club[] = ([
  { slug: '1000-crore', test: (f: Film) => isIndian(f) && f.gross.inr >= 1e10, native: 'INR' },
  { slug: '500-crore', test: (f: Film) => isIndian(f) && f.gross.inr >= 5e9, native: 'INR' },
  { slug: '100-crore', test: (f: Film) => isIndian(f) && f.gross.inr >= 1e9, native: 'INR' },
  { slug: '1-billion-dollar', test: (f: Film) => f.gross.usd >= 1e9, native: 'USD' },
] as const).map(({ slug, test, native }) => ({ slug, native, list: films.filter(test) }));
export const clubBySlug = new Map(CLUBS.map((c) => [c.slug, c]));

const isExactDate = (f: Film) => Boolean(f.date) && !f.date!.endsWith('-01-01');
const ageDays = (f: Film) => (TODAY - Date.parse(`${f.date}T00:00:00Z`)) / DAY_MS;
/** Films released in the last 60 days (exact dates only), biggest first. */
export const nowShowing = films.filter((f) => isExactDate(f) && ageDays(f) >= 0 && ageDays(f) < 60).slice(0, 12);

/** Day-wise rows that added something. */
export const dailyRows = (f: Film): DailyRow[] => (f.daily || []).filter((d) => d.added.usd > 0);

export const personFor = (name: string) => people.get(slugify(name));

export const STATS: Stats = {
  site: SITE.name, url: SITE.url, email: CONTACT_EMAIL, analytics: Boolean(GA_ID),
  films: films.length, indian: indian.length, people: people.size, languages: languages.length,
  firstYear: yearsSorted.at(-1)!, lastYear: yearsSorted[0], rate: RATE.inrPerUsd, rateDate: RATE.date,
  topIndian: indian[0], topWorld: worldwide[0], worldwideCount: worldwide.length,
  clubs: Object.fromEntries(CLUBS.map((c) => [c.slug, c.list])) as Record<ClubSlug, Film[]>,
  liveCount: films.filter((f) => f.live).length,
};

// ---------- films in cinemas (the /live/ page and /live.json) ----------

/** Released in the last 60 days, or older but still getting reported figures in the last two weeks. */
const CINEMA_DAYS = 60;
const STILL_REPORTING_DAYS = 14;
const lastReportOf = (f: Film): string | null => f.live?.coveredThrough ?? f.daily?.at(-1)?.date ?? null;
const reportAgeDays = (f: Film) => {
  const last = lastReportOf(f);
  return last ? (TODAY - Date.parse(`${last}T00:00:00Z`)) / DAY_MS : Infinity;
};
const liveActive = (f: Film) => Boolean(f.live) && reportAgeDays(f) <= 5; // the browser stops estimating after 4 full days

/** Theatrical release: Day 1 of the day-by-day reports when there are any, else the catalog date. */
export const releaseOf = (f: Film): string => {
  const first = f.daily?.[0];
  if (!first) return f.date!;
  return new Date(Date.parse(`${first.date}T00:00:00Z`) - (first.day - 1) * DAY_MS).toISOString().slice(0, 10);
};

function trendOf(f: Film): CinemaEntry['trend'] {
  const rows = f.daily || [];
  const out: CinemaEntry['trend'] = [];
  rows.forEach((row, i) => {
    if (row.added.usd <= 0) return;
    const from = (rows[i - 1]?.day ?? 0) + 1;
    const span = Math.max(1, row.day - from + 1);
    out.push({ from, to: row.day, usd: Math.round(row.added.usd / span), inr: Math.round(row.added.inr / span) });
  });
  return out.slice(-10);
}

export const inCinemas: Film[] = films
  .filter((f) => isExactDate(f) && ageDays(f) >= 0
    && (ageDays(f) < CINEMA_DAYS || reportAgeDays(f) <= STILL_REPORTING_DAYS))
  // Running live estimates first, biggest daily business first; then the rest by total.
  .sort((a, b) => Number(liveActive(b)) - Number(liveActive(a))
    || (liveActive(a) ? b.live!.base.usd - a.live!.base.usd : b.gross.usd - a.gross.usd));

export const cinemaBoard = (): CinemaBoard => ({
  generatedAt: data.generatedAt,
  checkedAt: sourcesCheckedAt,
  films: inCinemas.map((f) => {
    const lang = f.languages.map((name) => languageByName.get(name)).find(Boolean);
    const name = lang?.name ?? f.languages[0];
    return {
      id: f.id,
      slug: f.slug,
      title: f.title,
      language: name ? { en: name, hi: lang?.hi ?? hindiLanguageName(name) } : null,
      release: releaseOf(f),
      gross: { usd: f.gross.usd, inr: f.gross.inr },
      native: nativeOf(f),
      live: f.live ?? null,
      liveNow: liveActive(f),
      lastReport: lastReportOf(f),
      poster: artUrl(f, 'poster', 'w92'),
      trend: trendOf(f),
    };
  }),
});

/** Search index: films + people, kept compact. Served as /search.json. */
export const searchIndex = () => ({
  films: films.map((f) => [f.title, f.year, f.slug, f.gross.usd, f.gross.inr, isIndian(f) ? 1 : 0]),
  people: [...people.values()].map((p) => [p.name, p.slug, p.films.length]),
});

export type { RankItem };
