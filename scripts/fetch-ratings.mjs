// IMDb user ratings for the films in the catalog, from IMDb's daily public dataset (title.ratings.tsv.gz,
// https://developer.imdb.com/non-commercial-datasets/). The file covers every title on IMDb (~1.6M rows,
// ~8 MB gzipped); only films whose Wikidata entry has an IMDb ID (P345) are kept.
// Input: data/raw/wikidata.json. Output: data/raw/ratings.json → { fetchedAt, source, ratings: { tt…: { rating, votes } } }
import { createGunzip } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { fetchWithRetry } from './lib/http.mjs';

// Off unless IMDB_RATINGS=1. IMDb licenses this dataset for personal and non-commercial use only, and a site
// with ads is commercial: turn it on only with a licence that covers your use (see README "IMDb ratings").
if (process.env.IMDB_RATINGS !== '1') {
  console.log('IMDb ratings: off (set IMDB_RATINGS=1 only if you have a licence for commercial use).');
  process.exit(0);
}

const URL_RATINGS = 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const OUT = new URL('../data/raw/ratings.json', import.meta.url);
const WIKIDATA = new URL('../data/raw/wikidata.json', import.meta.url);

async function main() {
  const wd = JSON.parse(await readFile(WIKIDATA, 'utf8'));
  const wanted = new Set(Object.values(wd.films).map((f) => f.imdb).filter(Boolean));
  if (!wanted.size) throw new Error('No IMDb IDs in data/raw/wikidata.json (run node scripts/fetch-wikidata.mjs first).');

  const res = await fetchWithRetry(URL_RATINGS, { timeoutMs: 180_000 }, { label: 'IMDb ratings' });
  const lines = createInterface({ input: Readable.fromWeb(res.body).pipe(createGunzip()), crlfDelay: Infinity });

  // Columns: tconst, averageRating, numVotes (first line is the header).
  const ratings = {};
  let header = true;
  for await (const line of lines) {
    if (header) { header = false; continue; }
    const tab = line.indexOf('\t');
    const id = line.slice(0, tab);
    if (!wanted.has(id)) continue;
    const [, rating, votes] = line.split('\t');
    const r = Number(rating);
    const v = Number(votes);
    if (r > 0 && r <= 10 && v > 0) ratings[id] = { rating: r, votes: v };
  }

  await writeFile(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), source: URL_RATINGS, ratings }));
  console.log(`IMDb ratings: ${Object.keys(ratings).length} of ${wanted.size} films with an IMDb ID`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
