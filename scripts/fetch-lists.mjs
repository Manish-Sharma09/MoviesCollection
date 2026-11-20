// Films linked from Wikipedia's "highest-grossing" list pages. merge.mjs uses them to catch vandalised
// infoboxes: a film claiming ₹700 crore or $1.2 billion has to be on the matching list.
// (Real cases: "Prince" (2010) edited to "$1,000 million", "Ratsasan" to "₹5060 crore".)
// Output: data/raw/lists.json
import { writeFile } from 'node:fs/promises';
import { getJson, sleep } from './lib/http.mjs';

const OUT = new URL('../data/raw/lists.json', import.meta.url);
const LISTS = {
  indian: ['List of highest-grossing Indian films', 'List of highest-grossing films in India'],
  worldwide: ['List of highest-grossing films'],
};

/** Article titles linked from a page, with redirects resolved to the real article title. */
async function linkedTitles(page) {
  const titles = new Set();
  let cont = {};
  do {
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', generator: 'links', titles: page,
      gplnamespace: '0', gpllimit: 'max', redirects: '1', ...cont,
    });
    const json = await getJson(`https://en.wikipedia.org/w/api.php?${params}`, {}, { label: page });
    for (const p of json.query?.pages || []) if (!p.missing) titles.add(p.title);
    cont = json.continue || null;
    await sleep(6500); // stay under Wikipedia's anonymous rate limit
  } while (cont);
  return titles;
}

async function main() {
  const out = { fetchedAt: new Date().toISOString() };
  for (const [key, pages] of Object.entries(LISTS)) {
    const all = new Set();
    for (const page of pages) for (const t of await linkedTitles(page)) all.add(t);
    out[key] = [...all].sort();
    console.log(`${key}: ${out[key].length} linked articles`);
  }
  await writeFile(OUT, JSON.stringify(out));
  console.log('Saved → data/raw/lists.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
