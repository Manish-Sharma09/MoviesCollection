// Things worked out across films: this year's race between Indian languages, and ready-made pairs for the
// compare tool. Server-only, like ./data.
import { byYear, filmBySlug, films, indian, inCinemas, languageByName, NOW_YEAR, posterUrl } from './data';
import { adjustedIndian } from './inflation';
import type { Film, Language, Money } from './types';

// ---------- the box office race by language ----------

export interface RaceRow {
  language: Language;
  total: Money;
  count: number;
  top: Film;
}

/**
 * This year's Indian releases grouped by original language (the first one listed), biggest total first.
 * Falls back to last year early in a year, while few films have figures.
 */
export function languageRace(minFilms = 10): { year: number; rows: RaceRow[] } | null {
  for (const year of [NOW_YEAR, NOW_YEAR - 1]) {
    const list = (byYear.get(year) || []).filter((f) => f.indian);
    if (list.length < minFilms) continue;
    const groups = new Map<Language, Film[]>();
    for (const f of list) {
      const lang = f.languages.map((l) => languageByName.get(l)).find(Boolean);
      if (!lang) continue;
      groups.set(lang, [...(groups.get(lang) || []), f]);
    }
    const rows = [...groups.entries()]
      .map(([language, group]) => ({
        language,
        count: group.length,
        top: group[0], // byYear lists are sorted by gross
        total: group.reduce((s, f) => ({ usd: s.usd + f.gross.usd, inr: s.inr + f.gross.inr }), { usd: 0, inr: 0 }),
      }))
      .sort((a, b) => b.total.inr - a.total.inr)
      .slice(0, 6);
    if (rows.length >= 2) return { year, rows };
  }
  return null;
}

// ---------- compare: ready-made pairs ----------

export interface PairFilm { slug: string; title: string; year: number | null; poster: string }
export interface Pair { a: PairFilm; b: PairFilm; label: string }

const pairFilm = (f: Film): PairFilm => ({ slug: f.slug, title: f.title, year: f.year, poster: posterUrl(f, 120) });

/** Up to `n` interesting match-ups, each film used once: this year's top two, old against new, and so on. */
export function comparePairs(n = 6): Pair[] {
  const out: Pair[] = [];
  const used = new Set<string>();
  const free = (list: Film[]) => list.filter((f) => !used.has(f.id));
  const add = (a: Film | undefined, b: Film | undefined, label: string) => {
    if (!a || !b || a.id === b.id || out.length >= n) return;
    used.add(a.id);
    used.add(b.id);
    out.push({ a: pairFilm(a), b: pairFilm(b), label });
  };
  /** The two biggest films of a list that no earlier match-up has used. */
  const two = (list: Film[], label: string) => {
    const [a, b] = free(list);
    add(a, b, label);
  };
  const thisYear = (byYear.get(NOW_YEAR) || []).filter((f) => f.indian);
  two(inCinemas.filter((f) => f.live || f.daily?.length), 'In cinemas now');
  two(thisYear, `Biggest of ${NOW_YEAR}`);
  // The biggest Hindi film of the year against the biggest from the south.
  add(free(thisYear).find((f) => f.languages[0] === 'Hindi'),
    free(thisYear).find((f) => ['Telugu', 'Tamil', 'Malayalam', 'Kannada'].includes(f.languages[0])), 'Hindi vs South');
  two(indian, 'All-time Indian record');
  // An old classic against today's biggest, in today's money.
  const classic = adjustedIndian.find((x) => x.year && x.year < 1990 && x.slug && !used.has(x.id!));
  add(classic?.slug ? filmBySlug.get(classic.slug) : undefined, free(indian)[0], 'Then vs now');
  two(films.filter((f) => !f.indian), 'Worldwide record');
  return out;
}
