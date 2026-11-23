// The all-time worldwide chart from Wikipedia's "List of highest-grossing films" (its top-50 table),
// read through the free MediaWiki API. Wikipedia text is CC BY-SA; the site links to the list wherever
// the chart is shown.
//
// Output: data/raw/worldwide-lifetime.json, written only when the article has a newer revision and the
// table reads cleanly. Any failure keeps the last valid copy (or the bundled data/worldwide-lifetime.json).
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { CHART_PAGE, cachedChart, readChart, validateChart } from '../src/lib/worldwide-chart.ts';
import { getJson, sleep } from './lib/http.mjs';
import { parseGrossingTable } from './lib/wikipedia-chart.mjs';

const API = 'https://en.wikipedia.org/w/api.php';
const api = (params) => getJson(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, {}, { label: CHART_PAGE });

try {
  const page = (await api({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp', titles: CHART_PAGE })).query.pages[0];
  const revision = page?.revisions?.[0];
  if (!revision) throw new Error(`No revision found for "${CHART_PAGE}".`);
  const previous = await readChart();

  if (previous.revid === revision.revid) {
    console.log(`Worldwide chart: Wikipedia list unchanged (revision ${revision.revid}).`);
  } else {
    await sleep(6500); // Wikipedia's anonymous rate limit
    const sections = (await api({ action: 'parse', oldid: String(revision.revid), prop: 'sections' })).parse.sections;
    const section = sections.find((s) => s.line === 'Highest-grossing films')?.index ?? '1';
    await sleep(6500);
    const html = (await api({
      action: 'parse', oldid: String(revision.revid), prop: 'text', section, disablelimitreport: '1', disableeditsection: '1',
    })).parse.text;

    // The table is in rank order; sorting by gross keeps the chart consistent if an edit has
    // updated a figure before moving the film to its new rank.
    const rows = parseGrossingTable(html).sort((a, b) => b.usd - a.usd);

    // The list sometimes links a redirect ("Rogue One: A Star Wars Story" → "Rogue One"). The site matches
    // rows to its films by article title, so each link is resolved to the article it lands on.
    const target = new Map();
    for (let i = 0; i < rows.length; i += 50) {
      await sleep(6500);
      const titles = rows.slice(i, i + 50).map((r) => r.article);
      const { query } = await api({ action: 'query', titles: titles.join('|'), redirects: '1' });
      const normalized = new Map((query.normalized || []).map((n) => [n.from, n.to]));
      const redirects = new Map((query.redirects || []).map((r) => [r.from, r.to]));
      for (const t of titles) {
        const name = normalized.get(t) ?? t;
        target.set(t, redirects.get(name) ?? name);
      }
    }

    const chart = validateChart({
      asOf: revision.timestamp, revid: revision.revid,
      films: rows.map((r) => [r.title, r.year, r.usd, target.get(r.article) ?? r.article]),
    });
    const temp = join(dirname(cachedChart), `worldwide-lifetime.${process.pid}.tmp`);
    await mkdir(dirname(cachedChart), { recursive: true });
    await writeFile(temp, JSON.stringify(chart));
    await rename(temp, cachedChart);
    console.log(`Worldwide chart: ${chart.films.length} films from revision ${revision.revid} (${revision.timestamp}).`);
  }
} catch (error) {
  console.warn(`::warning::Worldwide chart refresh failed (${error.message}). Keeping the last valid copy.`);
}
