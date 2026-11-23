// Box office in today's money. A film's reported gross is raised by consumer prices in the country of the
// currency it was reported in, from its release year to the latest year with figures (World Bank CPI,
// scripts/fetch-cpi.mjs), and then converted at the site's one exchange rate like every other amount.
// Server-only, like ./data. With no CPI file (a fresh checkout), nothing is adjusted and the pages say nothing.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { films, isIndian } from './data';
import type { Film, Money, RankItem } from './types';

type Series = Record<string, number>;
const readRaw = <T>(file: string, fallback: T): T => {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'data/raw', file), 'utf8')) as T;
  } catch {
    return fallback;
  }
};
const cpi = readRaw<{ series?: Record<string, Series> }>('cpi.json', {}).series ?? {};

// Old films' figures on Wikipedia are patchy, and multiplying a wrong 1960s figure by 90 makes a wrong record.
// An old film is adjusted only when its article is linked from Wikipedia's highest-grossing lists
// (scripts/fetch-lists.mjs), or when even the adjusted figure is modest.
const lists = readRaw<{ indian?: string[]; worldwide?: string[] }>('lists.json', {});
const onLists = new Set([...(lists.indian ?? []), ...(lists.worldwide ?? [])]);
const RECENT_FACTOR = 1.5;
const MODEST = { inr: 3e9, usd: 5e8 }; // ₹300 crore, $500 million

const latestOf = (s?: Series) => (s ? Math.max(...Object.keys(s).map(Number)) : -Infinity);
/**
 * The year amounts are raised to: the latest year with figures for both the US and India, so one label fits
 * every list (other countries without that year are left unadjusted). Null without CPI data.
 */
export const CPI_YEAR: number | null = cpi.USA && cpi.IND ? Math.min(latestOf(cpi.USA), latestOf(cpi.IND)) : null;

// The country whose prices an amount follows, by the currency it was reported in.
const BY_CURRENCY: Record<string, string> = {
  USD: 'USA', INR: 'IND', GBP: 'GBR', JPY: 'JPN', AUD: 'AUS', CAD: 'CAN', NZD: 'NZL', HKD: 'HKG', KRW: 'KOR', CNY: 'CHN',
  SEK: 'SWE', NOK: 'NOR', DKK: 'DNK', CHF: 'CHE', PHP: 'PHL', MYR: 'MYS', BDT: 'BGD', PKR: 'PAK', LKR: 'LKA', NPR: 'NPL',
  SGD: 'SGP', THB: 'THA', EGP: 'EGY', NGN: 'NGA',
  // Pre-euro currencies (converted at their fixed euro rates by scripts/fetch-rates.mjs).
  DEM: 'DEU', FRF: 'FRA', ITL: 'ITA', ESP: 'ESP', NLG: 'NLD', BEF: 'BEL', ATS: 'AUT', FIM: 'FIN', PTE: 'PRT', IEP: 'IRL', GRD: 'GRC',
};
// Currencies replaced by a new unit: older amounts may be in the old unit, so only films from then on are adjusted.
const SINCE: Record<string, [country: string, year: number]> = { RUB: ['RUS', 1998], MXN: ['MEX', 1993], BRL: ['BRA', 1995], TRY: ['TUR', 2005] };
const EURO: Record<string, string> = {
  DE: 'DEU', FR: 'FRA', IT: 'ITA', ES: 'ESP', NL: 'NLD', BE: 'BEL', AT: 'AUT', FI: 'FIN', PT: 'PRT', IE: 'IRL', GR: 'GRC', LU: 'LUX',
};

function countryFor(f: Film): string | null {
  const cur = f.gross.currency;
  if (cur === 'EUR') return f.countries.map((c) => EURO[c]).find(Boolean) ?? 'DEU';
  if (SINCE[cur]) return f.year && f.year >= SINCE[cur][1] ? SINCE[cur][0] : null;
  return BY_CURRENCY[cur] ?? null;
}

export interface Adjusted {
  /** The gross in CPI_YEAR prices. */
  money: Money;
  /** How many times prices rose between the release year and CPI_YEAR. */
  factor: number;
}

const cache = new Map<string, Adjusted | null>();

/** The film's gross in CPI_YEAR prices, or null when its year or currency has no price figures. */
export function adjustedOf(f: Film): Adjusted | null {
  if (cache.has(f.id)) return cache.get(f.id)!;
  let out: Adjusted | null = null;
  const country = countryFor(f);
  const s = country ? cpi[country] : undefined;
  if (CPI_YEAR && f.year && s?.[CPI_YEAR]) {
    const from = s[Math.min(f.year, CPI_YEAR)];
    const factor = from ? s[CPI_YEAR] / from : NaN;
    const money = { usd: f.gross.usd * factor, inr: f.gross.inr * factor };
    const trusted = factor < RECENT_FACTOR || (f.enwiki && onLists.has(f.enwiki))
      || (isIndian(f) ? money.inr < MODEST.inr : money.usd < MODEST.usd);
    // A factor this large means a currency reform or hyperinflation, where a plain price index misleads.
    if (factor > 0 && factor < 400 && trusted) out = { money, factor };
  }
  cache.set(f.id, out);
  return out;
}

/** Shown on a film page when prices have moved enough since its release to make a difference. */
export const worthShowing = (a: Adjusted | null): a is Adjusted => Boolean(a && a.factor >= 1.05);

export interface AdjustedItem extends RankItem {
  /** The reported (nominal) gross. */
  reported: Money;
}

const LIST_LENGTH = 500;
const toItem = (f: Film, a: Adjusted): AdjustedItem => ({
  id: f.id, slug: f.slug, title: f.title, year: f.year, gross: a.money, reported: { usd: f.gross.usd, inr: f.gross.inr },
});
const rank = (list: Film[], key: keyof Money) => list
  .map((f) => [f, adjustedOf(f)] as const)
  .filter((x): x is readonly [Film, Adjusted] => x[1] !== null)
  .sort((a, b) => b[1].money[key] - a[1].money[key])
  .slice(0, LIST_LENGTH)
  .map(([f, a]) => toItem(f, a));

/** All films by gross in CPI_YEAR prices (each in its own currency's prices, compared in dollars). */
export const adjustedWorld: AdjustedItem[] = rank(films, 'usd');
/** Indian films by gross in CPI_YEAR prices (rupees). */
export const adjustedIndian: AdjustedItem[] = rank(films.filter(isIndian), 'inr');
/** Places on the adjusted lists, by film id, for the film page. */
export const adjustedRank = {
  world: new Map(adjustedWorld.map((f, i) => [f.id!, i + 1])),
  india: new Map(adjustedIndian.map((f, i) => [f.id!, i + 1])),
};
