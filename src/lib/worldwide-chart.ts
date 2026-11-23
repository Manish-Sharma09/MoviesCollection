// The all-time worldwide chart: the top-50 table of Wikipedia's "List of highest-grossing films"
// (scripts/fetch-worldwide-chart.mjs). Read by the pages at build time and by that script (Node runs this
// file directly: keep imports to node: built-ins and TypeScript erasable). Paths are relative to the
// project root, where npm scripts run.
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const CHART_PAGE = 'List of highest-grossing films';
export const CHART_URL = 'https://en.wikipedia.org/wiki/List_of_highest-grossing_films';

/** Title as shown on the list, release year, worldwide gross in US$, and the linked Wikipedia article. */
export type ChartRow = [title: string, year: number, usd: number, article: string];
export interface Chart {
  /** When the list was last edited (the revision the rows come from). */
  asOf: string;
  revid: number;
  films: ChartRow[];
}

export const bundledChart = join(process.cwd(), 'data', 'worldwide-lifetime.json');
export const cachedChart = join(process.cwd(), 'data', 'raw', 'worldwide-lifetime.json');

const MIN_ROWS = 25;
const MAX_ROWS = 200;

export function validateChart({ asOf, revid, films }: { asOf?: unknown; revid?: unknown; films?: unknown }): Chart {
  const observedAt = Date.parse(String(asOf));
  const timestamp = typeof asOf === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(asOf);
  if (!timestamp || !Number.isFinite(observedAt) || observedAt > Date.now()) {
    throw new Error('The chart needs a valid revision timestamp with a time zone.');
  }
  if (!Number.isSafeInteger(revid) || (revid as number) <= 0) throw new Error('The chart needs a revision id.');
  if (!Array.isArray(films) || films.length < MIN_ROWS || films.length > MAX_ROWS) {
    throw new Error(`Expected ${MIN_ROWS} to ${MAX_ROWS} chart rows.`);
  }

  const seen = new Set<string>();
  let previousGross = Infinity;
  for (const row of films) {
    if (!Array.isArray(row) || row.length !== 4) throw new Error('Invalid chart row.');
    const [title, year, gross, article] = row;
    if (typeof title !== 'string' || !title.trim() || typeof article !== 'string' || !article.trim() ||
        !Number.isInteger(year) || year < 1888 || year > new Date().getUTCFullYear() + 1 ||
        !Number.isSafeInteger(gross) || gross <= 0 || gross > previousGross) {
      throw new Error('Chart rows must contain title, year, USD gross and article, in descending gross order.');
    }
    if (seen.has(article)) throw new Error(`Duplicate article in chart: ${article}`);
    seen.add(article);
    previousGross = gross;
  }

  return { asOf: asOf as string, revid: revid as number, films: films as ChartRow[] };
}

/** The newer of the bundled snapshot and the cached copy (data/raw), ignoring an invalid cache. */
function newest(bundledText: string, readCached: () => string): Chart {
  const bundled = validateChart(JSON.parse(bundledText));
  try {
    const cached = validateChart(JSON.parse(readCached()));
    if (Date.parse(cached.asOf) >= Date.parse(bundled.asOf)) return cached;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('Worldwide chart: ignoring unreadable or invalid cache.');
  }
  return bundled;
}

export async function readChart(): Promise<Chart> {
  const cached = await readFile(cachedChart, 'utf8').catch((error: NodeJS.ErrnoException) => error);
  return newest(await readFile(bundledChart, 'utf8'), () => {
    if (cached instanceof Error) throw cached;
    return cached;
  });
}

export function readChartSync(): Chart {
  return newest(readFileSync(bundledChart, 'utf8'), () => readFileSync(cachedChart, 'utf8'));
}
