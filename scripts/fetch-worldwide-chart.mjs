// Reads an authorized JSON feed backed by licensed Box Office Mojo data.
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { cachedChart, readChart, validateChart } from '../src/lib/worldwide-chart.ts';

const endpoint = process.env.BOX_OFFICE_CHART_URL?.trim();
const token = process.env.BOX_OFFICE_CHART_TOKEN?.trim();

if (endpoint) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') throw new Error('HTTPS required.');
    const headers = { accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(url, {
      headers, redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Feed request failed.');
    const chart = validateChart(await response.json());
    const previous = await readChart();

    if (Date.parse(chart.asOf) <= Date.parse(previous.asOf)) {
      console.log('Worldwide chart: the feed has no newer snapshot.');
    } else {
      const temp = join(dirname(cachedChart), `worldwide-lifetime.${process.pid}.tmp`);
      await mkdir(dirname(cachedChart), { recursive: true });
      await writeFile(temp, JSON.stringify(chart));
      await rename(temp, cachedChart);
      console.log(`Worldwide chart: updated to ${chart.asOf}.`);
    }
  } catch {
    // Avoid logging credentials or provider response bodies.
    console.warn('::warning::Worldwide chart refresh failed. Keeping the last valid snapshot.');
  }
} else {
  console.log('Worldwide chart: no authorized feed configured. Using the last valid snapshot.');
}
