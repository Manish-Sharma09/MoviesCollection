// Release dates of upcoming films, shared by the pages (build time) and the browser (src/components/client/Release.tsx).
import { CLIENT_TEXT } from '@/content/client-text';
import type { Lang } from './format';
import { DAY, istMidnight } from './live';

/** Day of the run on `now`: release day is Day 1 (India time). */
export const dayOfRun = (release: string, now: number) => Math.max(1, Math.floor((now - istMidnight(release)) / DAY) + 1);

/** "Releases in 5 days", "Releases tomorrow", "Releases today", "Out now · Day 2"; short: "In 5 days", "Tomorrow", "Out now". */
export function releaseInText(release: string, now: number, lang: Lang, short = false): string {
  const text = CLIENT_TEXT[lang];
  const start = istMidnight(release);
  if (now >= start) return short ? text.shortOut : text.outNow(dayOfRun(release, now));
  const today = istMidnight(new Date(now + 5.5 * 3_600_000).toISOString().slice(0, 10));
  const days = Math.round((start - today) / DAY);
  if (short) return days <= 0 ? text.shortToday : days === 1 ? text.shortTomorrow : text.shortIn(days);
  return days <= 0 ? text.releasesToday : days === 1 ? text.releasesTomorrow : text.releasesIn(days);
}

/** "Fri, 4 Dec" (with the year when it isn't this year's), in the page's language. */
export function releaseDate(iso: string, lang: Lang, now = Date.now()): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const sameYear = d.getUTCFullYear() === new Date(now).getUTCFullYear();
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC',
  });
}
