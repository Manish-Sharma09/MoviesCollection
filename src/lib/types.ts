import type { Currency } from './format';

export interface Money {
  usd: number;
  inr: number;
}

/** A reported amount as written by scripts/merge.mjs. */
export interface Amount extends Money {
  amount: number;
  currency: string;
  low?: number;
  high?: number;
  approx?: boolean;
  source: string;
  text?: string;
  scope?: 'worldwide' | 'unspecified';
  asOf?: string;
}

export interface DailyRow {
  date: string;
  day: number;
  total: Money;
  added: Money;
}

/** Films in cinemas: the IST day the last report covers and the estimated daily base. */
export interface LiveInfo {
  coveredThrough: string;
  base: Money;
}

/** One film in data/movies.json. */
export interface Film {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  indian: boolean;
  date: string | null;
  countries: string[];
  languages: string[];
  directors: string[];
  starring: string[];
  runtime: number | null;
  imdb: string | null;
  /** IMDb user rating (out of 10) and vote count, from scripts/fetch-ratings.mjs. */
  rating?: { value: number; votes: number } | null;
  enwiki: string | null;
  gross: Amount;
  domestic: Amount | null;
  india: Amount | null;
  budget: Amount | null;
  rank: number;
  daily?: DailyRow[];
  live?: LiveInfo;
}

/**
 * A film due in cinemas in the next 60 days, or out in the last week with no figure reported yet
 * (scripts/merge.mjs). It gets a page at /movie/<slug>/ that counts down to release; once its first
 * figure is reported it moves to `films` and the same address becomes its box office page.
 */
export interface UpcomingFilm {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  indian: boolean;
  /** The cinema release (YYYY-MM-DD) counted down to: the first of its Wikidata dates in the window. */
  release: string;
  /** The earliest date Wikidata knows, often a festival premiere. */
  date: string | null;
  countries: string[];
  languages: string[];
  directors: string[];
  starring: string[];
  runtime: number | null;
  imdb: string | null;
  enwiki: string;
  budget: Amount | null;
  distributors: string[];
  /** Wikipedia language editions with an article on the film: a rough measure of how widely it is known. */
  sitelinks: number;
}

/** An advance booking (ticket pre-sales) amount reported in a film's Wikipedia article. */
export interface Advance extends Money {
  /** The article gives it as a floor or an estimate ("over ₹20 crore"). */
  approx: boolean;
  /** The sentence it was read from. */
  quote: string;
}

export interface MoviesFile {
  generatedAt: string;
  sources: { wikipedia?: string };
  rates: { date: string; inrPerUsd: number };
  films: Film[];
  upcoming?: UpcomingFilm[];
}

/**
 * A place on the all-time worldwide chart, matched to a catalog film when possible. `listed` rows come
 * from Wikipedia's "List of highest-grossing films"; the rest are catalog films ranked by their own figure.
 */
export interface ChartFilm {
  id?: string;
  slug?: string;
  title: string;
  year: number | null;
  rank: number;
  gross: Money;
  listed: boolean;
}

/** Anything a ranked list can show: catalog films and chart rows. */
export type RankItem = Pick<Film, 'title'> & {
  id?: string;
  slug?: string;
  year: number | null;
  gross: Money;
  live?: LiveInfo;
};

export type ClubSlug = '1000-crore' | '500-crore' | '100-crore' | '1-billion-dollar';

export interface Club {
  slug: ClubSlug;
  native: Currency;
  list: Film[];
}

export interface Person {
  name: string;
  slug: string;
  films: Film[];
  roles: Set<'director' | 'actor'>;
}

export interface Language {
  name: string;
  hi: string;
  slug: string;
  list: Film[];
  native: Currency;
}

/** Facts the written content (about, FAQ, home article) quotes. Recomputed every build. */
export interface Stats {
  site: string;
  url: string;
  email: string | null;
  /** SITE_OWNER: the person or business that runs the site, or null. */
  owner: string | null;
  analytics: boolean;
  /** Google AdSense is set up (ADSENSE_CLIENT): the privacy policy and terms describe advertising. */
  ads: boolean;
  films: number;
  indian: number;
  people: number;
  languages: number;
  firstYear: number;
  lastYear: number;
  rate: number;
  rateDate: string;
  topIndian: Film | undefined;
  /** The five highest-grossing Hindi (Bollywood) films, for the FAQ. */
  topBollywood: Film[];
  topWorld: ChartFilm | undefined;
  worldwideCount: number;
  /** How many of the chart's places come from Wikipedia's highest-grossing list (the top of the chart). */
  listedCount: number;
  clubs: Record<ClubSlug, Film[]>;
  liveCount: number;
}

// ---------- films in cinemas (/live/ and /live.json) ----------

/**
 * One film in cinemas, everything the live board shows (plain data: it is also served as /live.json
 * so an open page can pick up new reported figures without reloading).
 */
export interface CinemaEntry {
  id: string;
  slug: string;
  title: string;
  /** Main language, in English and Hindi. */
  language: { en: string; hi: string } | null;
  /**
   * Theatrical release (YYYY-MM-DD) that day numbers count from: Day 1 of the day-by-day reports when there
   * are any (Wikidata's date is sometimes a festival premiere months earlier), else the catalog date.
   */
  release: string;
  gross: { usd: number; inr: number };
  native: 'INR' | 'USD';
  live: { coveredThrough: string; base: { usd: number; inr: number } } | null;
  /** Whether the live estimate was running when the site was built (decides the group). */
  liveNow: boolean;
  /** The IST day the latest reported figure covers. */
  lastReport: string | null;
  poster: string;
  /**
   * Collection per day for the latest reports (up to 10), oldest first. A report that covers several
   * days (Wikipedia skipped some) is shown as the average per day over those days, not as one tall bar.
   */
  trend: { from: number; to: number; usd: number; inr: number }[];
}

export interface CinemaBoard {
  /** Changes with every data update; an open page reloads its figures when it differs. */
  generatedAt: string;
  checkedAt: string | null;
  films: CinemaEntry[];
}

// ---------- the compare tool (/compare/) ----------

/**
 * What the compare tool needs about one film. Each film page carries it as JSON (script#film-facts), so the
 * tool reads it from the page itself and the site needs no extra file per film.
 */
export interface FilmFacts {
  slug: string;
  title: string;
  year: number | null;
  date: string | null;
  language: string | null;
  director: string | null;
  stars: string[];
  poster: string;
  native: 'INR' | 'USD';
  gross: Money;
  budget: Money | null;
  /** The gross in `adjustedYear` prices (src/lib/inflation.ts). */
  adjusted: Money | null;
  adjustedYear: number | null;
  yearRank: number | null;
  yearCount: number;
  /** Place on the all-time worldwide chart (/top/). */
  chartRank: number | null;
  indiaNet: Money | null;
  overseas: Money | null;
  opening: Money | null;
  biggestDay: Money | null;
  /** Reported running totals, [day, usd, inr]. */
  days: [number, number, number][];
  live: LiveInfo | null;
  showing: boolean;
}
