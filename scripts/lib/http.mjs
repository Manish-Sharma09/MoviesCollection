// Polite HTTP helpers for public data sources (Wikidata, Wikipedia, exchange rates).
// Wikimedia asks every client to send a descriptive User-Agent. Set CONTACT_UA to
// something like "MovieCollectionBot/1.0 (https://your-site.example)" once the site is live.

export const USER_AGENT =
  process.env.CONTACT_UA || 'MovieCollectionBot/0.1 (open box office data site)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(url, options = {}, { retries = 4, label = url } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: { 'User-Agent': USER_AGENT, ...(options.headers || {}) },
        signal: AbortSignal.timeout(options.timeoutMs || 90_000),
      });
      if (res.status === 429 || res.status >= 500) {
        const wait = Number(res.headers.get('retry-after')) * 1000 || 2000 * 2 ** attempt;
        throw Object.assign(new Error(`HTTP ${res.status} for ${label}`), { wait });
      }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${label}`), { fatal: true });
      return res;
    } catch (err) {
      lastErr = err;
      if (err.fatal || attempt === retries) break;
      const wait = err.wait || 2000 * 2 ** attempt;
      console.warn(`  retrying ${label} in ${Math.round(wait / 1000)}s (${err.message})`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

export async function getJson(url, opts, meta = {}) {
  // The body can also time out or arrive cut short, so reading it is retried as well.
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchWithRetry(url, opts, meta);
      return JSON.parse(await res.text());
    } catch (err) {
      if (err.fatal || attempt >= 3) throw err;
      console.warn(`  retrying ${meta.label || url}: ${err.message}`);
      await sleep(3000 * 2 ** attempt);
    }
  }
}

/** Run a SPARQL query against the Wikidata Query Service and return rows as plain objects. */
export async function sparql(query, label = 'sparql') {
  let json;
  for (let attempt = 0; ; attempt++) {
    const res = await fetchWithRetry(
      'https://query.wikidata.org/sparql',
      {
        method: 'POST',
        headers: {
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ query }).toString(),
        timeoutMs: 120_000,
      },
      { label }
    );
    try {
      // The query service sometimes cuts a response off mid-stream when it hits its own timeout.
      json = JSON.parse(await res.text());
      break;
    } catch (err) {
      if (attempt >= 4) throw err;
      console.warn(`  retrying ${label}: incomplete response`);
      await sleep(3000 * 2 ** attempt);
    }
  }
  return json.results.bindings.map((b) => {
    const row = {};
    for (const [k, v] of Object.entries(b)) row[k] = v.value;
    return row;
  });
}

export { sleep };
