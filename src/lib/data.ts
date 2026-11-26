// Everything the pages need, computed once per build worker from data/movies.json
// (written by scripts/merge.mjs). Server-only: never import this from a client component.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hindiLanguageName, slugify, type Currency } from './format';
import { ADSENSE_CLIENT, CONTACT_EMAIL, GA_ID, SITE } from './site';
import type {
  Advance, ChartFilm, CinemaBoard, CinemaEntry, Club, ClubSlug, DailyRow, Film, Language, Money, MoviesFile, Person, RankItem, Stats,
  UpcomingFilm,
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
/** Films due in cinemas soon, or just out with no figure yet; soonest first (scripts/merge.mjs). */
export const upcoming: UpcomingFilm[] = data.upcoming ?? [];
export const RATE = data.rates;
/** When Wikipedia was last read (ISO time), shown on the home page. */
export const sourcesCheckedAt: string | null = data.sources?.wikipedia ?? null;

export const NOW_YEAR = new Date().getUTCFullYear();
const DAY_MS = 86_400_000;
const TODAY = Date.now();
/** When this build ran; the live page computes its first (static) render at this moment. */
export const BUILD_TIME = TODAY;

// ---------- posters ----------

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
for (const f of [...films, ...upcoming]) {
  const p = f.enwiki ? wikiPages[f.enwiki] : undefined;
  if (p?.thumb && WIKIMEDIA.test(p.thumb)) wikiPosterById.set(f.id, p);
}

/** Poster widths Wikimedia serves as standard thumbnails: list rows, cards, and the film page's structured data. */
export type PosterWidth = 120 | 330 | 500;

// ---------- your own artwork (public/banners/) ----------
// High-quality images you supply, named after the film's slug (the part of its page address after /movie/):
//   <slug>.jpg         a wide banner (landscape, ~1920×1080): a sharp full-bleed backdrop on the home page
//                      spotlight and the film page's board
//   <slug>-poster.jpg  a high-resolution poster (portrait, ~600×900): replaces the Wikipedia poster wherever
//                      posters are shown at 330px or larger (small list thumbnails keep Wikipedia's small file)
// .jpg, .jpeg, .png, .webp and .avif all work. The file's modified time goes into the address, so replacing
// a file shows the new one straight away despite long browser caching.
const ART_DIR = join(process.cwd(), 'public', 'banners');
const ART_EXT = /\.(jpe?g|png|webp|avif)$/i;
// A build reads the folder once. `next dev` re-reads it every few seconds, so images you add or remove
// show up on the next page load without restarting the server.
const DEV = process.env.NODE_ENV !== 'production';
let ownArtCache: { at: number; map: Map<string, string> } | null = null;
function ownArt(): Map<string, string> {
  if (ownArtCache && (!DEV || Date.now() - ownArtCache.at < 3000)) return ownArtCache.map;
  const map = new Map<string, string>();
  try {
    for (const name of readdirSync(ART_DIR)) {
      if (!ART_EXT.test(name)) continue;
      const version = Math.round(statSync(join(ART_DIR, name)).mtimeMs).toString(36);
      map.set(name.replace(ART_EXT, '').toLowerCase(), `/banners/${encodeURIComponent(name)}?v=${version}`);
    }
  } catch { /* no banners folder: Wikipedia posters only */ }
  ownArtCache = { at: Date.now(), map };
  return map;
}

/** Your wide banner for a film (public/banners/<slug>.jpg), or '' when there is none. */
export const bannerUrl = (f: { slug?: string }): string => (f.slug && ownArt().get(f.slug)) || '';

/** The film's Wikipedia poster only (the fallback when your own image fails to load). */
export function wikiPosterUrl(f: { id?: string }, width: PosterWidth): string {
  const wiki = f.id ? wikiPosterById.get(f.id) : undefined;
  return wiki ? wikimediaAt(wiki.original || wiki.thumb!, wiki.width, width) : '';
}

/** A film's poster: your high-resolution one for larger sizes, else its Wikipedia poster at the given width, or ''. */
export function posterUrl(f: { id?: string; slug?: string }, width: PosterWidth): string {
  const own = width >= 330 && f.slug ? ownArt().get(`${f.slug}-poster`) : undefined;
  if (own) return own;
  const wiki = f.id ? wikiPosterById.get(f.id) : undefined;
  return wiki ? wikimediaAt(wiki.original || wiki.thumb!, wiki.width, width) : '';
}

// ---------- photos of people ----------
// Wikimedia Commons only (free licences; shown with the photographer's credit).

interface CommonsFile { thumb?: string; page?: string; artist?: string | null; license?: string | null; licenseUrl?: string | null }
const commons = readJson<{ people?: Record<string, { file: string }>; files?: Record<string, CommonsFile> }>('data/raw/people.json', {});

export interface Photo {
  url: string;
  credit: { artist: string | null; license: string | null; licenseUrl: string | null; page: string };
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
  return null;
}

// ---------- India / overseas split ----------
// Totals written in each Indian film's Wikipedia "Box office" section (scripts/fetch-boxoffice.mjs). A figure is
// shown only when it agrees with the film's worldwide gross: India net 15–95% of it, India gross 18–100% and
// 1.03–1.4× the net, overseas 2–85%, and India plus overseas within 20% of the worldwide total.

type TextFigure = { inr?: number; usd?: number };
type TextAdvance = TextFigure & { approx?: boolean; quote?: string };
const boxText = readJson<{ pages?: Record<string, {
  indiaNet?: TextFigure; indiaGross?: TextFigure; overseas?: TextFigure; advance?: TextAdvance | null;
}> }>('data/raw/boxoffice.json', {}).pages || {};

export interface Markets { indiaNet?: Money; indiaGross?: Money; overseas?: Money }

const asMoney = (a?: TextFigure): Money | undefined => {
  if (!a || !(a.inr || a.usd)) return undefined;
  return a.inr ? { inr: a.inr, usd: a.inr / RATE.inrPerUsd } : { usd: a.usd!, inr: a.usd! * RATE.inrPerUsd };
};

export function marketsOf(f: Film): Markets | null {
  const e = f.indian && f.enwiki ? boxText[f.enwiki] : undefined;
  if (!e) return null;
  const share = (m: Money) => m.inr / f.gross.inr;
  let net = asMoney(e.indiaNet);
  let gross = asMoney(e.indiaGross);
  let overseas = asMoney(e.overseas);
  if (net && !(share(net) >= 0.15 && share(net) <= 0.95)) net = undefined;
  if (gross && !(share(gross) >= 0.18 && share(gross) <= 1)) gross = undefined;
  if (net && gross && !(gross.inr / net.inr >= 1.03 && gross.inr / net.inr <= 1.4)) gross = undefined;
  if (overseas && !(share(overseas) >= 0.02 && share(overseas) <= 0.85)) overseas = undefined;
  const india = gross?.inr ?? (net ? net.inr * 1.18 : undefined);
  if (overseas && india && Math.abs((india + overseas.inr) / f.gross.inr - 1) > 0.2) overseas = undefined;
  if (!net && !gross && !overseas) return null;
  return { ...(net && { indiaNet: net }), ...(gross && { indiaGross: gross }), ...(overseas && { overseas }) };
}

/** The advance booking (ticket pre-sales) amount the film's Wikipedia article reports, or null. */
export function advanceOf(f: { enwiki: string | null }): Advance | null {
  const a = f.enwiki ? boxText[f.enwiki]?.advance : null;
  const money = asMoney(a ?? undefined);
  return a && money ? { ...money, approx: Boolean(a.approx), quote: a.quote ?? '' } : null;
}

// ---------- upcoming films ----------

/** Today in India (YYYY-MM-DD) when the site was built. */
const TODAY_IST = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
export const upcomingBySlug = new Map(upcoming.map((f) => [f.slug, f]));
/** Already in cinemas (release day or later) but no figure reported yet. */
export const isOut = (f: UpcomingFilm) => f.release <= TODAY_IST;
/** Not out yet, soonest first. */
export const comingSoon = upcoming.filter((f) => !isOut(f));
/** Out in the last week, no figure yet, newest first. */
export const justOut = upcoming.filter(isOut).reverse();
/** The best-known upcoming films first (Wikipedia language editions), for short lists like the home page. */
export const notableFirst = (list: UpcomingFilm[]) => [...list].sort((a, b) => b.sitelinks - a.sitelinks || a.release.localeCompare(b.release));

// ---------- all-time worldwide chart ----------
// The top 50 come from Wikipedia's "List of highest-grossing films" (src/lib/worldwide-chart.ts); every
// other film follows by the worldwide gross on its own Wikipedia article. 500 places in all.

export { CHART_URL } from './worldwide-chart';
export const chart = readChartSync();
const CHART_LENGTH = 500;

const byArticle = new Map(films.filter((f) => f.enwiki).map((f) => [f.enwiki!, f]));
const chartKey = (title: string, year: number | null) => `${slugify(title)}-${year}`;
// Fallback match by title and year, for a film whose article was renamed since the list was read;
// ambiguous titles stay unmatched.
const byTitle = new Map<string, Film | null>();
for (const film of films) {
  const key = chartKey(film.title, film.year);
  byTitle.set(key, byTitle.has(key) ? null : film);
}

const listed: ChartFilm[] = chart.films.map(([title, year, usd, article]) => {
  const film = byArticle.get(article) ?? byTitle.get(chartKey(title, year)) ?? undefined;
  return { id: film?.id, slug: film?.slug, title, year, rank: 0, gross: { usd, inr: Math.round(usd * RATE.inrPerUsd) }, listed: true };
});
const onList = new Set(listed.map((f) => f.id).filter(Boolean));
// A film whose own article claims at least the list's smallest figure, yet is not on the list, disagrees
// with the list (rounded or differently counted totals, such as re-releases); it is left out rather than
// ranked below films it claims to beat.
const listFloor = listed.at(-1)?.gross.usd ?? Infinity;
export const worldwide: ChartFilm[] = [
  ...listed,
  ...films.filter((f) => !onList.has(f.id) && f.gross.usd < listFloor).slice(0, CHART_LENGTH - listed.length).map((f) => ({
    id: f.id, slug: f.slug, title: f.title, year: f.year, rank: 0, gross: { usd: f.gross.usd, inr: f.gross.inr }, listed: false,
  })),
].map((f, i) => ({ ...f, rank: i + 1 }));
/** Films on Wikipedia's list, by id: their film pages quote the list's figure and rank. */
export const worldwideById = new Map(worldwide.filter((f) => f.listed && f.id).map((f) => [f.id!, f]));

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
// Cloudflare Pages takes at most 20,000 files per site (scripts/postbuild.mjs). Film pages always come first; should the
// catalogue grow that far, a person then needs more films for a page of their own, instead of the build failing.
const PAGE_BUDGET = 19_000;
const OTHER_PAGES = 1_000; // home, lists, years, languages, Hindi pages, guides, assets (~400 today)
const personRoom = PAGE_BUDGET - OTHER_PAGES - films.length - upcoming.length;
let minFilms = 3;
while ([...peopleMap.values()].filter((p) => p.films.size >= minFilms).length > personRoom && minFilms < 50) minFilms++;
export const people = new Map<string, Person>(
  [...peopleMap.values()]
    .filter((p) => p.films.size >= minFilms)
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

/** Day-wise rows that added something. */
export const dailyRows = (f: Film): DailyRow[] => (f.daily || []).filter((d) => d.added.usd > 0);

export const personFor = (name: string) => people.get(slugify(name));

export const STATS: Stats = {
  site: SITE.name, url: SITE.url, email: CONTACT_EMAIL, owner: SITE.owner, analytics: Boolean(GA_ID), ads: Boolean(ADSENSE_CLIENT),
  films: films.length, indian: indian.length, people: people.size, languages: languages.length,
  firstYear: yearsSorted.at(-1)!, lastYear: yearsSorted[0], rate: RATE.inrPerUsd, rateDate: RATE.date,
  topIndian: indian[0], topBollywood: (languageBySlug.get('hindi')?.list ?? []).slice(0, 5), topWorld: worldwide[0], worldwideCount: worldwide.length, listedCount: listed.length,
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

/** "No. 1 today": a film's place among those with a running estimate, by today's estimated business. */
export const todayRank = new Map(inCinemas.filter(liveActive).map((f, i) => [f.id, i + 1]));

// ---------- trending: what people are reading about ----------
// Views of each film's English Wikipedia article over the last 7 days (scripts/fetch-pageviews.mjs), for films
// out in the last year and those still to come. Older than 4 days, the figures are left unused.

const TRENDING_RECENT_DAYS = 365;
const TRENDING_STALE_DAYS = 4;
const pageViews = readJson<{ through?: string; pages?: Record<string, { views: number }> }>('data/raw/pageviews.json', {});
const viewsFresh = Boolean(pageViews.through) && (TODAY - Date.parse(`${pageViews.through}T00:00:00Z`)) / DAY_MS <= TRENDING_STALE_DAYS;

export interface TrendingItem { film: Film | UpcomingFilm; views: number }

/** Recent and upcoming films, most-read first (empty when there are no recent figures). */
export const trending: TrendingItem[] = !viewsFresh ? [] : [
  ...films.filter((f) => f.date && ageDays(f) <= TRENDING_RECENT_DAYS),
  ...upcoming,
]
  .map((film) => ({ film, views: (film.enwiki && pageViews.pages?.[film.enwiki]?.views) || 0 }))
  .filter((t) => t.views > 0)
  .sort((a, b) => b.views - a.views);

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
      poster: posterUrl(f, 120),
      trend: trendOf(f),
    };
  }),
});

/** Search index: films + people, kept compact. Served as /search.json. */
export const searchIndex = () => ({
  // Upcoming films have no figure yet (0): the search box labels them "Upcoming".
  films: [...films, ...upcoming].map((f) => 'gross' in f
    ? [f.title, f.year, f.slug, f.gross.usd, f.gross.inr, isIndian(f) ? 1 : 0]
    : [f.title, f.year, f.slug, 0, 0, f.indian ? 1 : 0]),
  people: [...people.values()].map((p) => [p.name, p.slug, p.films.length]),
});

export type { RankItem };
