// Live estimate between reported figures. Used by scripts/merge.mjs (daily base), by the pages,
// and in the browser by the live components, so there is one copy of the model.
// Node runs this file directly, so it must stay free of imports and non-erasable TypeScript.
//
// Model: a film earns `base` on an ordinary day, scaled by the day of the week (weekends earn
// more), shrinking slowly day by day, and spread through the day following show times.

export const DAY = 86_400_000;
export const IST_OFFSET = 5.5 * 3_600_000;

// Share of a week's business by day (Sunday first), relative to a Friday. Typical Indian pattern.
export const WEEKDAY_FACTOR = [1.6, 0.55, 0.55, 0.5, 0.45, 1.0, 1.35];

// How much of a day's collection has come in by each hour (India time), following show times.
export const SHOW_CURVE: [number, number][] = [[0, 0], [9, 0], [12, 0.1], [15, 0.28], [18, 0.5], [21, 0.8], [24, 1]];

// Day-on-day drop applied when projecting forward (about 35% a week).
export const DECAY = 0.94;

// Stop estimating when the last report is this old.
export const STALE_AFTER = 4 * DAY;

// The estimate moves in 5-minute steps, like a tracker's update cycle.
export const STEP = 5 * 60_000;

/** Midnight (UTC ms) of an IST calendar date "YYYY-MM-DD", i.e. 00:00 IST. */
export const istMidnight = (date: string): number => Date.parse(`${date}T00:00:00Z`) - IST_OFFSET;
export const istDay = (ms: number): string => new Date(ms + IST_OFFSET).toISOString().slice(0, 10);
export const istWeekday = (ms: number): number => new Date(ms + IST_OFFSET).getUTCDay();

export function dayShare(hour: number): number {
  for (let i = 1; i < SHOW_CURVE.length; i++) {
    const [h1, v1] = SHOW_CURVE[i];
    const [h0, v0] = SHOW_CURVE[i - 1];
    if (hour <= h1) return v0 + ((v1 - v0) * (hour - h0)) / (h1 - h0 || 1);
  }
  return 1;
}

/**
 * Estimated earnings after the day `coveredThrough` (IST date the last report runs to) up to `now`.
 * Returns { total, today } in the same unit as `base`.
 */
export function estimate({ base, coveredThrough }: { base: number; coveredThrough: string }, now: number) {
  let total = 0;
  let today = 0;
  let ahead = 1;
  for (let start = istMidnight(coveredThrough) + DAY; start < now; start += DAY, ahead++) {
    const hour = Math.min(24, (now - start) / 3_600_000);
    const day = base * WEEKDAY_FACTOR[istWeekday(start)] * DECAY ** ahead;
    const earned = day * dayShare(hour);
    total += earned;
    if (hour < 24) today = earned;
  }
  return { total, today };
}

/** What a live figure needs: reported total, the IST day it covers, and the daily base. */
export interface LiveInput {
  usd: number;
  inr: number;
  coveredThrough: string;
  base: { usd: number; inr: number };
}

export interface LiveState {
  usd: number;
  inr: number;
  today: { usd: number; inr: number };
  perHour: { usd: number; inr: number };
}

/** The live total at `now` (already rounded to a 5-minute step), or null outside the live window. */
export function liveState(live: LiveInput, now: number): LiveState | null {
  const reportEnd = istMidnight(live.coveredThrough) + DAY;
  if (!Number.isFinite(reportEnd) || now < reportEnd || now - reportEnd > STALE_AFTER) return null;
  const eu = estimate({ base: live.base.usd, coveredThrough: live.coveredThrough }, now);
  const ei = estimate({ base: live.base.inr, coveredThrough: live.coveredThrough }, now);
  const hu = estimate({ base: live.base.usd, coveredThrough: live.coveredThrough }, now - 3_600_000);
  const hi = estimate({ base: live.base.inr, coveredThrough: live.coveredThrough }, now - 3_600_000);
  return {
    usd: live.usd + eu.total,
    inr: live.inr + ei.total,
    today: { usd: eu.today, inr: ei.today },
    perHour: { usd: eu.total - hu.total, inr: ei.total - hi.total },
  };
}
