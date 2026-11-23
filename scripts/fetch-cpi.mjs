// Consumer prices by country (World Bank indicator FP.CPI.TOTL, 2010 = 100, yearly from 1960), for box office
// "in today's money" (src/lib/inflation.ts). Free, no key; one request.
// Output: data/raw/cpi.json  { source, lastUpdated, series: { IND: { "1960": 2.31, ... }, ... } }
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { getJson } from './lib/http.mjs';

const OUT = new URL('../data/raw/cpi.json', import.meta.url);

// Countries whose currencies films report grosses in (src/lib/inflation.ts maps currency → country).
const COUNTRIES = [
  'USA', 'IND', 'GBR', 'JPN', 'AUS', 'CAN', 'NZL', 'HKG', 'KOR', 'CHN', 'SWE', 'NOR', 'DNK', 'CHE', 'PHL', 'MYS', 'BGD',
  'PAK', 'LKA', 'NPL', 'SGP', 'THA', 'EGY', 'NGA', 'RUS', 'MEX', 'BRA', 'TUR',
  // Euro area, country by country (the World Bank has no recent figure for the euro area as a whole).
  'DEU', 'FRA', 'ITA', 'ESP', 'NLD', 'BEL', 'AUT', 'FIN', 'PRT', 'IRL', 'GRC', 'LUX',
];

async function main() {
  // The build passes --if-missing so a fresh checkout gets the file; the daily fetch always refreshes it.
  if (process.argv.includes('--if-missing') && existsSync(OUT)) return;
  const url = `https://api.worldbank.org/v2/country/${COUNTRIES.join(';')}/indicator/FP.CPI.TOTL?format=json&per_page=20000&date=1960:2100`;
  const [meta, rows] = await getJson(url, {}, { label: 'World Bank CPI' });
  if (!Array.isArray(rows) || !rows.length) throw new Error('World Bank CPI: no rows');
  const series = {};
  for (const r of rows) {
    if (typeof r.value !== 'number' || !(r.value > 0)) continue;
    (series[r.countryiso3code] ||= {})[r.date] = Math.round(r.value * 1e4) / 1e4;
  }
  for (const need of ['USA', 'IND']) if (!series[need]) throw new Error(`World Bank CPI: no series for ${need}`);
  await writeFile(OUT, JSON.stringify({ source: 'World Bank, FP.CPI.TOTL', lastUpdated: meta?.lastupdated ?? null, series }));
  const latest = Math.max(...Object.keys(series.IND).map(Number));
  console.log(`CPI: ${Object.keys(series).length} countries, India to ${latest} (${series.IND[latest]})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
