// Reads the open data sources the site is built from. Each script runs in its own process with a time limit, and one
// that fails or runs out of time is reported and skipped without stopping the rest. Every script keeps its last good
// file and saves what it has read as it goes, so the site is built from the newest data there is and the next run
// carries on where this one stopped.
//
//   node scripts/update-data.mjs         full update when the last one is 20+ hours old, otherwise films in cinemas only
//   node scripts/update-data.mjs --full  everything (npm run fetch)
//   node scripts/update-data.mjs --live  films in cinemas only: their Wikipedia articles and edit history (npm run fetch:live)
//   node scripts/update-data.mjs --art   posters, photos, India/overseas figures, page views; after merge (npm run fetch:art)
//
// The scheduled update (.github/workflows/update.yml) decides by the data's age, not by which schedule fired:
// GitHub delays and drops scheduled runs, and a full update tied to one daily slot went unrun for days.
// Exits 1 only when a file the build cannot do without is missing (first run, or no source reachable).
import { existsSync } from 'node:fs';
import { appendFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runStep } from './lib/steps.mjs';

const FULL_EVERY_HOURS = 20;
const raw = (name) => new URL(`../data/raw/${name}`, import.meta.url);

// minutes: the most each script may take. A normal run needs a fraction of it. The limits matter when the cached data
// is lost and everything has to be read again (about 2½ hours in all): that then takes a few runs instead of one.
const STEPS = {
  wikidata: { file: 'fetch-wikidata.mjs', minutes: 30 },
  wikipedia: { file: 'fetch-wikipedia.mjs', minutes: 75 },
  'wikipedia, films in cinemas': { file: 'fetch-wikipedia.mjs', minutes: 20, env: { WIKI_MAX_REFRESH: '0' } },
  history: { file: 'fetch-history.mjs', minutes: 25 },
  lists: { file: 'fetch-lists.mjs', minutes: 10 },
  rates: { file: 'fetch-rates.mjs', minutes: 5 },
  cpi: { file: 'fetch-cpi.mjs', minutes: 5 },
  'worldwide chart': { file: 'fetch-worldwide-chart.mjs', minutes: 10 },
  ratings: { file: 'fetch-ratings.mjs', minutes: 10 },
  posters: { file: 'fetch-posters.mjs', minutes: 25 },
  people: { file: 'fetch-people.mjs', minutes: 45 },
  'box office text': { file: 'fetch-boxoffice.mjs', minutes: 15 },
  'page views': { file: 'fetch-pageviews.mjs', minutes: 10 },
  'cpi if missing': { file: 'fetch-cpi.mjs', args: ['--if-missing'], minutes: 5 },
};

const PLANS = {
  full: ['wikidata', 'wikipedia', 'history', 'lists', 'rates', 'cpi', 'worldwide chart', 'ratings'],
  live: ['wikipedia, films in cinemas', 'history'],
  art: ['posters', 'people', 'box office text', 'page views', 'cpi if missing'],
};

// scripts/merge.mjs cannot run without these; everything else has a fallback.
const NEEDED = { full: ['wikidata.json', 'wikipedia.json', 'rates.json'], live: ['wikidata.json', 'wikipedia.json', 'rates.json'], art: [] };

async function lastFullUpdate() {
  try {
    return Date.parse(JSON.parse(await readFile(raw('wikidata.json'), 'utf8')).fetchedAt) || 0;
  } catch {
    return 0;
  }
}

const flag = process.argv.slice(2).find((a) => a.startsWith('--'))?.slice(2);
if (flag && !PLANS[flag]) {
  console.error(`Unknown option --${flag}. Use --full, --live or --art, or nothing to choose by the data's age.`);
  process.exit(2);
}
const last = await lastFullUpdate();
const ageHours = (Date.now() - last) / 3_600_000;
const mode = flag || (!last || ageHours >= FULL_EVERY_HOURS ? 'full' : 'live');
if (!flag) {
  console.log(!last
    ? 'No earlier data: full update.'
    : `Last full update ${ageHours.toFixed(1)} hours ago: ${mode === 'full' ? 'full update' : 'films in cinemas only'}.`);
}
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `mode=${mode}\n`);

const warn = (msg) => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `Warning: ${msg}`);
const results = [];
for (const name of PLANS[mode]) {
  const step = STEPS[name];
  console.log(`\n▶ ${name}`);
  const r = await runStep(fileURLToPath(new URL(step.file, import.meta.url)), step);
  results.push({ name, ...r });
  if (r.timedOut) warn(`${name}: stopped after ${step.minutes} minutes; the next run carries on from what it saved.`);
  else if (!r.ok) warn(`${name}: failed (exit code ${r.code}); the last good data is kept.`);
}

const minutes = (ms) => `${(ms / 60_000).toFixed(1)} min`;
console.log(`\nData update (${mode}):`);
for (const r of results) console.log(`  ${r.ok ? 'ok    ' : r.timedOut ? 'TIME  ' : 'FAILED'} ${r.name.padEnd(28)} ${minutes(r.ms)}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, [
    `### Data update (${mode})`, '', '| Source | Result | Time |', '| --- | --- | --- |',
    ...results.map((r) => `| ${r.name} | ${r.ok ? 'ok' : r.timedOut ? 'out of time' : 'failed'} | ${minutes(r.ms)} |`), '', '',
  ].join('\n'));
}

const missing = NEEDED[mode].filter((name) => !existsSync(raw(name)));
if (missing.length) {
  console.error(`Cannot build without data/raw/${missing.join(', data/raw/')}. The next run tries again.`);
  process.exit(1);
}
