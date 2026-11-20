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
  tmdb: string | null;
  enwiki: string | null;
  gross: Amount;
  domestic: Amount | null;
  india: Amount | null;
  budget: Amount | null;
  rank: number;
  daily?: DailyRow[];
  live?: LiveInfo;
}

export interface MoviesFile {
  generatedAt: string;
  sources: { wikipedia?: string };
  rates: { date: string; inrPerUsd: number };
  films: Film[];
}

/** A row of the Box Office Mojo worldwide chart, matched to a catalog film when possible. */
export interface ChartFilm {
  id?: string;
  slug?: string;
  tmdb?: string | null;
  title: string;
  year: number;
  rank: number;
  gross: Money;
}

/** Anything a ranked list can show: catalog films and chart rows. */
export type RankItem = Pick<Film, 'title'> & {
  id?: string;
  slug?: string;
  tmdb?: string | null;
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
  analytics: boolean;
  films: number;
  indian: number;
  people: number;
  languages: number;
  firstYear: number;
  lastYear: number;
  rate: number;
  rateDate: string;
  topIndian: Film | undefined;
  topWorld: ChartFilm | undefined;
  worldwideCount: number;
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
