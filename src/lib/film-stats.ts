// What the film page's dashboard shows, worked out from the reported day-by-day totals (scripts/merge.mjs):
// days grouped into weeks, round-number milestones, records, comparable films and other films in cinemas.
// Server-only, like ./data. Nothing here is estimated; the live estimate lives in ./live.
import { dailyRows, films, inCinemas, isIndian, nativeOf, posterUrl, releaseOf } from './data';
import type { Currency } from './format';
import { DAY, istMidnight } from './live';
import type { Film, LiveInfo, Money } from './types';

const ratio = (a: number, b: number) => (b > 0 ? (a - b) / b : null);
const per = (m: Money, n: number): Money => ({ usd: m.usd / n, inr: m.inr / n });

export interface DayEntry {
  /** Last day this report covers (days since release, 1 = release day). */
  day: number;
  /** First day it covers: earlier than `day` when days went without a new report. */
  from: number;
  date: string;
  /** 0 = Sunday … 6 = Saturday, of `date`. */
  weekday: number;
  weekend: boolean;
  added: Money;
  /** `added` spread over the days it covers. */
  perDay: Money;
  total: Money;
  /** Change in per-day business against the previous report, or null for the first. */
  change: number | null;
}

export interface WeekEntry {
  week: number;
  /** ISO dates of the week's first and last day (the last one capped at the latest report). */
  start: string;
  end: string;
  added: Money;
  days: DayEntry[];
  complete: boolean;
  /** Against the previous week, when both are complete. */
  change: number | null;
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function dayEntries(f: Film): DayEntry[] {
  const rows = dailyRows(f);
  const out: DayEntry[] = rows.map((r, i) => {
    const from = (rows[i - 1]?.day ?? 0) + 1;
    const span = Math.max(1, r.day - from + 1);
    const weekday = new Date(`${r.date}T00:00:00Z`).getUTCDay();
    return {
      day: r.day, from: span > 1 ? from : r.day, date: r.date, weekday, weekend: weekday === 0 || weekday >= 5,
      added: r.added, perDay: per(r.added, span), total: r.total, change: null,
    };
  });
  // A report published in the morning covers the day before (scripts/merge.mjs). While a live estimate runs,
  // the latest report is filed under the day it covers, so the estimated days that follow never overlap it.
  if (f.live && out.length) {
    const covered = Math.round((istMidnight(f.live.coveredThrough) - istMidnight(releaseOf(f))) / DAY) + 1;
    const last = out.at(-1)!;
    const prev = out.at(-2);
    if (covered < last.day) {
      if (prev && prev.day >= covered) {
        const added = { usd: prev.added.usd + last.added.usd, inr: prev.added.inr + last.added.inr };
        out.splice(-2, 2, { ...prev, added, perDay: per(added, Math.max(1, prev.day - prev.from + 1)), total: last.total });
      } else {
        const weekday = new Date(`${f.live.coveredThrough}T00:00:00Z`).getUTCDay();
        out.splice(-1, 1, {
          ...last, day: covered, from: Math.min(last.from, covered), date: f.live.coveredThrough, weekday,
          weekend: weekday === 0 || weekday >= 5, perDay: per(last.added, Math.max(1, covered - Math.min(last.from, covered) + 1)),
        });
      }
    }
  }
  out.forEach((d, i) => { d.change = i ? ratio(d.perDay.usd, out[i - 1].perDay.usd) : null; });
  return out;
}

export function weekEntries(f: Film, days: DayEntry[]): WeekEntry[] {
  if (!days.length) return [];
  const release = Date.parse(`${releaseOf(f)}T00:00:00Z`);
  const lastDay = days.at(-1)!.day;
  const weeks = new Map<number, DayEntry[]>();
  for (const d of days) {
    const w = Math.ceil(d.day / 7);
    weeks.set(w, [...(weeks.get(w) || []), d]);
  }
  const list = [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([week, list]) => ({
    week,
    start: isoDay(release + (week - 1) * 7 * DAY),
    end: isoDay(release + (Math.min(week * 7, lastDay) - 1) * DAY),
    added: list.reduce((s, d) => ({ usd: s.usd + d.added.usd, inr: s.inr + d.added.inr }), { usd: 0, inr: 0 }),
    days: list,
    complete: week * 7 <= lastDay,
    change: null as number | null,
  }));
  list.forEach((w, i) => {
    const prev = list[i - 1];
    if (prev && prev.complete && w.complete) w.change = ratio(w.added.usd, prev.added.usd);
  });
  return list;
}

// ---------- milestones ----------

const STEPS: Record<Currency, number[]> = {
  INR: [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].map((c) => c * 1e7),
  USD: [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].map((m) => m * 1e6),
};

/** A round step that gives at most eight milestones up to `value` (in the film's own currency). */
export function milestoneStep(value: number, cur: Currency): number {
  return STEPS[cur].find((s) => value / s <= 8) ?? STEPS[cur].at(-1)!;
}

export interface Crossing { value: number; day: number; date: string }

const inCur = (m: Money, cur: Currency) => (cur === 'INR' ? m.inr : m.usd);

/** Each milestone and the first reported day the total stood at or above it. */
export function crossings(days: DayEntry[], cur: Currency, step: number): Crossing[] {
  const out: Crossing[] = [];
  const last = days.at(-1);
  if (!last) return out;
  for (let m = step; m <= inCur(last.total, cur); m += step) {
    const d = days.find((x) => inCur(x.total, cur) >= m);
    if (d) out.push({ value: m, day: d.day, date: d.date });
  }
  return out;
}

export interface Records {
  biggestDay: DayEntry | null;
  openingDay: DayEntry | null;
  bestWeek: WeekEntry | null;
}

export function records(days: DayEntry[], weeks: WeekEntry[]): Records {
  const single = days.filter((d) => d.from === d.day);
  const openingDay = single.find((d) => d.day === 1) ?? null;
  const biggest = single.reduce<DayEntry | null>((best, d) => (!best || d.added.usd > best.added.usd ? d : best), null);
  return {
    // When the opening day was also the biggest, it is shown once (as the opening day).
    biggestDay: biggest && biggest !== openingDay ? biggest : null,
    openingDay,
    bestWeek: weeks.length > 1 ? weeks.reduce((best, w) => (w.added.usd > best.added.usd ? w : best)) : null,
  };
}

// ---------- head to head ----------

export interface Series {
  title: string;
  slug: string;
  self: boolean;
  /** [day, usd, inr] of each reported total. */
  points: [number, number, number][];
}

const totalBy = (days: DayEntry[], day: number) => [...days].reverse().find((d) => d.day <= day)?.total.usd ?? 0;

/** This film against up to three comparable films with day-by-day reports: same market, closest size by the same day. */
export function headToHead(f: Film, days: DayEntry[]): Series[] | null {
  const lastDay = days.at(-1)?.day ?? 0;
  if (days.length < 3 || lastDay < 3) return null;
  const candidates = films
    .filter((x) => x.id !== f.id && isIndian(x) === isIndian(f) && (x.daily?.length ?? 0) >= 4)
    .map((x) => ({ film: x, days: dayEntries(x) }))
    .filter((c) => c.days.length >= 3 && c.days.at(-1)!.day >= Math.min(7, lastDay));
  // Compared on the last day both runs have figures for (capped at a month), so neither gets extra days.
  const scoreOf = (c: { days: DayEntry[] }) => {
    const at = Math.min(lastDay, c.days.at(-1)!.day, 30);
    const mine = totalBy(days, at);
    return mine ? Math.abs(Math.log(Math.max(1, totalBy(c.days, at)) / mine)) : Infinity;
  };
  const picked = candidates
    .map((c) => ({ ...c, score: scoreOf(c) }))
    .filter((c) => Number.isFinite(c.score))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  if (!picked.length) return null;
  const pts = (list: DayEntry[], until: number) =>
    list.filter((d) => d.day <= until).map((d): [number, number, number] => [d.day, Math.round(d.total.usd), Math.round(d.total.inr)]);
  return [
    { title: f.title, slug: f.slug, self: true, points: pts(days, lastDay) },
    ...picked.map((c) => ({ title: c.film.title, slug: c.film.slug, self: false, points: pts(c.days, lastDay + 14) })),
  ];
}

// ---------- other films in cinemas ----------

export interface AlsoLive {
  slug: string;
  title: string;
  poster: string;
  release: string;
  gross: Money;
  native: Currency;
  live: LiveInfo | null;
}

export const alsoInCinemas = (f: Film, n = 10): AlsoLive[] =>
  inCinemas.filter((x) => x.id !== f.id).slice(0, n).map((x) => ({
    slug: x.slug, title: x.title, poster: posterUrl(x, 120), release: releaseOf(x),
    gross: { usd: x.gross.usd, inr: x.gross.inr }, native: nativeOf(x), live: x.live ?? null,
  }));

/** Day of the run at a moment (1 = release day, India time). */
export const runDay = (release: string, now: number) => Math.floor((now - istMidnight(release)) / DAY) + 1;
