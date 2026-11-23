// Figures the guides quote (src/content/guides.ts), worked out from the data on every build so the
// articles stay current. Server-only, like ./data.
import type { GuideFacts } from '@/content/guides';
import { CLUBS, films, inCinemas, isIndian, languages, STATS, worldwide } from './data';

function compute(): GuideFacts {
  // Decades of the films in the all-time worldwide top 100.
  const top100 = worldwide.slice(0, 100);
  const byDecade = new Map<number, number>();
  for (const f of top100) {
    if (!f.year) continue;
    const decade = Math.floor(f.year / 10) * 10;
    byDecade.set(decade, (byDecade.get(decade) || 0) + 1);
  }
  const oldest = top100.filter((f) => f.year).sort((a, b) => a.year! - b.year!)[0] ?? null;

  // Indian languages with the most films.
  const indianLanguages = languages
    .filter((l) => l.native === 'INR')
    .slice(0, 6)
    .map((l) => {
      const list = l.list.filter(isIndian);
      return { name: l.name, slug: l.slug, count: list.length, top: list[0], c100: list.filter((f) => f.gross.inr >= 1e9).length };
    })
    .filter((l) => l.top);

  // Gross against reported budget.
  const budgeted = films.filter((f) => f.budget && f.budget.usd > 0);
  const ratio = (f: (typeof films)[number]) => f.gross.usd / f.budget!.usd;

  // The newest film (by release date) in each crore club.
  const newestInClub = Object.fromEntries(CLUBS.map((c) => {
    const dated = c.list.filter((f) => f.date && !f.date.endsWith('-01-01'));
    return [c.slug, dated.sort((a, b) => b.date!.localeCompare(a.date!))[0]];
  })) as GuideFacts['newestInClub'];

  // A film in cinemas with a long day-wise record, as a worked example.
  const dailyExample = [...inCinemas].sort((a, b) => (b.daily?.length || 0) - (a.daily?.length || 0))[0];

  return {
    s: STATS,
    decades: [...byDecade.entries()].sort((a, b) => b[0] - a[0]).map(([decade, count]) => ({ decade, count })),
    oldestInTop100: oldest,
    indianLanguages,
    budget: {
      films: budgeted.length,
      atLeast2_5: budgeted.filter((f) => ratio(f) >= 2.5).length,
      underBudget: budgeted.filter((f) => ratio(f) < 1).length,
    },
    newestInClub,
    dailyExample: dailyExample && (dailyExample.daily?.length || 0) >= 7 ? dailyExample : null,
  };
}

let cached: GuideFacts | null = null;
/** Computed once per build worker. */
export const guideFacts = (): GuideFacts => (cached ||= compute());
