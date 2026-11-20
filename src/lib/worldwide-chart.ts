// Box Office Mojo worldwide top-200 snapshot. Read by the pages at build time and by
// scripts/fetch-worldwide-chart.mjs (Node runs this file directly: keep imports to node: built-ins
// and TypeScript erasable). Paths are relative to the project root, where npm scripts run.
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ChartRow = [title: string, year: number, usd: number];
export interface Chart {
  asOf: string;
  films: ChartRow[];
}

export const bundledChart = join(process.cwd(), 'data', 'worldwide-lifetime.json');
export const cachedChart = join(process.cwd(), 'data', 'raw', 'worldwide-lifetime.json');

export function validateChart({ asOf, films }: { asOf?: unknown; films?: unknown }): Chart {
  const observedAt = Date.parse(String(asOf));
  const timestamp = typeof asOf === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(asOf);
  if (!timestamp || !Number.isFinite(observedAt) || observedAt > Date.now()) {
    throw new Error('The chart needs a valid source timestamp with a time zone.');
  }

  if (!Array.isArray(films) || films.length !== 200) {
    throw new Error('Expected the complete top 200 worldwide chart.');
  }

  const seen = new Set<string>();
  let previousGross = Infinity;
  for (const row of films) {
    if (!Array.isArray(row) || row.length !== 3) throw new Error('Invalid chart row.');
    const [title, year, gross] = row;
    if (typeof title !== 'string' || !title.trim() || !Number.isInteger(year) ||
        year < 1888 || year > new Date().getUTCFullYear() + 1 ||
        !Number.isSafeInteger(gross) || gross <= 0 || gross > previousGross) {
      throw new Error('Chart rows must contain title, year and USD gross in descending gross order.');
    }
    const key = JSON.stringify([title.trim().toLowerCase(), year]);
    if (seen.has(key)) throw new Error('Duplicate title and year in chart.');
    seen.add(key);
    previousGross = gross;
  }

  return { asOf: asOf as string, films: films as ChartRow[] };
}

/** The newer of the bundled snapshot and the cached feed (data/raw), ignoring an invalid cache. */
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
