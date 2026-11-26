// Safety checks for the scheduled update (.github/workflows/update.yml).
//
//   --before-deploy  Stops the deploy when the new build has lost a large share of its films (a source changed its
//                    format, a parser broke). The site online stays as it was, and the failed run makes GitHub send
//                    its failure email. A good build is remembered in data/raw/last-good.json for the next comparison.
//   --freshness      Fails when a source has not been read successfully for days. Runs still deploy with the last
//                    good data, so without this a source that keeps failing would go unnoticed.
//   --status         Prints a short JSON summary of the data (the keep-alive commit writes it to data/status.json).
import { readFile } from 'node:fs/promises';
import { saveJson } from './lib/steps.mjs';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MIN_SHARE = 0.9; // a build with fewer than 90% of the last good build's films is not deployed
const file = (path) => new URL(`../${path}`, import.meta.url);
const readJson = (path) => readFile(file(path), 'utf8').then(JSON.parse).catch(() => null);
const fail = (msg) => {
  // In an Actions annotation a line break has to be written %0A, or only the first line is shown.
  const escaped = msg.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(process.env.GITHUB_ACTIONS ? `::error::${escaped}` : `Error: ${msg}`);
  process.exitCode = 1;
};

const mode = process.argv[2];

if (mode === '--before-deploy') {
  const movies = await readJson('data/movies.json');
  const last = await readJson('data/raw/last-good.json');
  const films = movies?.films?.length || 0;
  if (!films) fail('data/movies.json has no films; not deploying.');
  else if (last?.films && films < last.films * MIN_SHARE) {
    fail(`Only ${films} films, down from ${last.films} in the last good build (${last.at}). A data source has probably `
      + 'changed its format, so the site online is left as it was. This check passes again once the films are back.');
  } else {
    await saveJson(file('data/raw/last-good.json'), { at: new Date().toISOString(), films, upcoming: movies.upcoming?.length || 0 });
    console.log(`Build check: ${films} films${last?.films ? ` (last good build: ${last.films})` : ''}.`);
  }
} else if (mode === '--freshness') {
  // [file, timestamp field, longest acceptable gap]. Runs come every few hours; a full update about once a day.
  const SOURCES = [
    ['data/raw/wikidata.json', 'fetchedAt', 3 * DAY, 'Wikidata (film list)'],
    ['data/raw/wikipedia.json', 'fetchedAt', 2 * DAY, 'Wikipedia infoboxes (grosses)'],
    ['data/raw/history.json', 'fetchedAt', 2 * DAY, 'Wikipedia edit history (day by day)'],
    ['data/raw/rates.json', 'fetchedAt', 4 * DAY, 'exchange rates'],
    ['data/raw/lists.json', 'fetchedAt', 4 * DAY, "Wikipedia's highest-grossing lists"],
    ['data/raw/posters.json', 'fetchedAt', 3 * DAY, 'posters'],
    ['data/raw/people.json', 'fetchedAt', 3 * DAY, 'photos of people'],
    ['data/raw/boxoffice.json', 'fetchedAt', 3 * DAY, 'India / overseas figures'],
    ['data/raw/pageviews.json', 'fetchedAt', 3 * DAY, 'Wikipedia page views (trending)'],
  ];
  const stale = [];
  for (const [path, field, maxAge, label] of SOURCES) {
    const at = Date.parse((await readJson(path))?.[field] || '');
    const age = Date.now() - at;
    if (!(age < maxAge)) stale.push(`${label}: ${at ? `last read ${Math.floor(age / HOUR)} hours ago` : 'never read'} (${path})`);
  }
  if (stale.length) {
    fail(`Some data sources have not been read for a while. The site keeps showing the last good data, but the run `
      + `logs above show what went wrong:\n  - ${stale.join('\n  - ')}`);
  } else {
    console.log(`All ${SOURCES.length} data sources read recently.`);
  }
} else if (mode === '--status') {
  const movies = await readJson('data/movies.json');
  const last = await readJson('data/raw/last-good.json');
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    dataFrom: movies?.generatedAt ?? null,
    films: movies?.films?.length ?? null,
    upcoming: movies?.upcoming?.length ?? null,
    lastGoodBuild: last?.at ?? null,
  }, null, 2));
} else {
  console.error('Use --before-deploy, --freshness or --status.');
  process.exit(2);
}
