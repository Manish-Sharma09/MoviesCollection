// Combines Wikidata + Wikipedia + exchange rates into one clean list of films.
// Output: data/movies.json
import { readFile, writeFile } from 'node:fs/promises';
import { slugify } from '../src/lib/format.ts';
import { DAY, IST_OFFSET, WEEKDAY_FACTOR, istMidnight, istWeekday } from '../src/lib/live.ts';

const read = async (name) => JSON.parse(await readFile(new URL(`../data/raw/${name}`, import.meta.url), 'utf8'));

const PLACE = { WORLDWIDE: 'Q13780930', US: 'Q30', NORTH_AMERICA: 'Q49', INDIA: 'Q668' };
const MAX_USD = 4e9; // nothing has grossed more than ~$3B; anything above is a parsing error
const MIN_USD = 1e3;

const INDIAN_LANGUAGES = new Set([
  'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'Punjabi', 'Gujarati',
  'Odia', 'Assamese', 'Bhojpuri', 'Urdu', 'Haryanvi', 'Konkani', 'Tulu', 'Sanskrit', 'Rajasthani',
  'Meitei', 'Manipuri', 'Kashmiri', 'Sindhi', 'Maithili', 'Chhattisgarhi', 'Khasi', 'Garhwali', 'Badaga',
]);

/**
 * An Indian film is made in India and in an Indian language (or India is the only country).
 * This keeps Hollywood co-productions with an Indian studio (Real Steel, Bridge of Spies…) out.
 */
function isIndianFilm({ countries, languages }, gross) {
  if (!countries.includes('IN')) return gross.currency === 'INR' && !countries.length;
  return countries.length === 1 || languages.some((l) => INDIAN_LANGUAGES.has(l));
}

// Country names as written in Wikipedia infoboxes → ISO codes.
const COUNTRY_CODE = new Map();
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
for (let a = 65; a <= 90; a++) {
  for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);
    try {
      const name = regionNames.of(code);
      if (name && name !== code) COUNTRY_CODE.set(name.toLowerCase(), code);
    } catch { /* not a region code */ }
  }
}
for (const [name, code] of Object.entries({
  'united states of america': 'US', usa: 'US', 'u.s.': 'US', us: 'US', america: 'US',
  uk: 'GB', 'great britain': 'GB', britain: 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
  'west germany': 'DE', 'east germany': 'DE', 'soviet union': 'RU', ussr: 'RU', 'hong kong': 'HK',
  macau: 'MO', 'south korea': 'KR', korea: 'KR', 'czech republic': 'CZ', czechoslovakia: 'CZ',
  turkey: 'TR', burma: 'MM', 'british india': 'IN', 'republic of china': 'TW', 'people\'s republic of china': 'CN',
})) COUNTRY_CODE.set(name, code);

/**
 * Wikipedia's infobox wins over Wikidata for country and language: Wikidata items get vandalised
 * (The Lion King (2019) was once labelled "Hindi", country India).
 */
function countriesFrom(film, page) {
  const codes = (page?.country || [])
    .map((n) => COUNTRY_CODE.get(n.toLowerCase().replace(/\.$/, '').trim()))
    .filter(Boolean);
  return codes.length ? [...new Set(codes)] : film.countries;
}

// Wikidata and Wikipedia name some languages differently; use one name for each.
const LANGUAGE_ALIASES = {
  'Standard Chinese': 'Mandarin', 'Mandarin Chinese': 'Mandarin', Putonghua: 'Mandarin', Chinese: 'Mandarin',
  'Yue Chinese': 'Cantonese', 'Modern Standard Arabic': 'Arabic', 'Hindustani': 'Hindi', 'Filipino': 'Tagalog',
  'Meitei': 'Manipuri', 'Odia language': 'Odia', 'Oriya': 'Odia', 'American English': 'English', 'British English': 'English',
};

function languagesFrom(film, page) {
  const names = (page?.language || []).filter((l) => /^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(l));
  const list = names.length ? names : film.languages;
  return [...new Set(list.map((l) => LANGUAGE_ALIASES[l] || l))];
}

const belowGross = (part, gross) => (part && part.usd < gross.usd ? part : null);

// Streaming services: a film distributed only by these premieres online, not in cinemas, so it is left off
// the upcoming list. Studios that also release in cinemas (Amazon MGM Studios, Apple Original Films) are not here.
const STREAMING = /^(?:netflix|prime video|amazon prime video|disney\+(?: hotstar)?|jiohotstar|hotstar|hulu|max|hbo max|peacock|paramount\+|apple tv\+?|zee5|sonyliv|aha|jiocinema|mubi|lionsgate play|sun nxt|manoramamax|etv win|hoichoi|mx player|tubi|youtube)$/i;

/**
 * From the end-of-day infobox figures (history.json) work out:
 *  - daily: the reported total at the end of each day since release, and how much it grew;
 *  - live: what the browser needs to estimate the total between reports.
 * Wikipedia reports are treated as covering a day once edited after 8 pm IST, otherwise the day before.
 */
function dailyAndLive(gross, hist, revs) {
  if (gross.source !== 'wikipedia' || !hist?.days?.length) return {};
  const release = istMidnight(hist.release);
  const points = [];
  let max = 0;
  for (const [date, revid, ts] of hist.days) {
    const r = revs[revid];
    if (!r || r[0] !== gross.currency) continue;
    const day = Math.round((istMidnight(date) - release) / DAY) + 1;
    if (day < 1) continue;
    // Skip figures well above today's (vandalism not yet seen). A figure a little above today's was corrected
    // down later (an estimate replaced by the actual, $225.0M → $224.3M, or a switch of source, ₹1,732 cr →
    // ₹1,638 cr): it is capped at today's figure and does not hold up the days after it, so the growth
    // reported after the correction still shows. Before this, those days stayed flat at the old peak, the
    // report looked days old, and the live estimate switched off. Otherwise never go down (reverted vandalism).
    if (r[1] > gross.low * 1.02) continue;
    const v = r[1] > gross.low ? gross.low : Math.max(r[1], max);
    if (r[1] <= gross.low) max = v;
    const tsMs = Date.parse(ts);
    const istHour = new Date(tsMs + IST_OFFSET).getUTCHours();
    points.push({ date, day, v, covered: istHour >= 20 ? date : new Date(istMidnight(date) - DAY + IST_OFFSET).toISOString().slice(0, 10) });
  }
  if (!points.length) return {};
  // A total is never above a later one: a corrected peak comes down to the next lower figure.
  for (let i = points.length - 2; i >= 0; i--) points[i].v = Math.min(points[i].v, points[i + 1].v);
  const scale ={ usd: gross.usd / gross.amount, inr: gross.inr / gross.amount };
  const m = (v) => ({ usd: Math.round(v * scale.usd), inr: Math.round(v * scale.inr) });
  const daily = points.map((p, i) => ({ date: p.date, day: p.day, total: m(p.v), added: m(p.v - (i ? points[i - 1].v : 0)) }));

  // Live: average earnings over the three days before the current figure, adjusted for weekday.
  const last = points.at(-1);
  let first = points.length - 1;
  while (first > 0 && points[first - 1].v === last.v) first--;
  const coveredThrough = points[first].covered;
  const end = istMidnight(coveredThrough);
  const startPoint = points.slice(0, first).reverse().find((p) => istMidnight(p.covered) <= end - 3 * DAY);
  const startV = startPoint ? startPoint.v : 0;
  const from = startPoint ? istMidnight(startPoint.covered) + DAY : release;
  let weight = 0;
  for (let d = from; d <= end; d += DAY) weight += WEEKDAY_FACTOR[istWeekday(d)];
  const base = weight > 0 ? (last.v - startV) / weight : 0;
  const live = base > 0 && last.v === gross.low
    ? { coveredThrough, base: m(base) }
    : null;
  return { daily, ...(live && { live }) };
}

/** Wikidata's earliest date, or, when that is only a year (YYYY-01-01), the earliest date that year known to the day. */
function dayDate(film) {
  const year = film.date?.endsWith('-01-01') ? film.date.slice(0, 4) : null;
  const exact = year ? (film.dates || []).filter((d) => d.startsWith(year)).sort()[0] : null;
  return exact || film.date;
}

function titleFrom(film) {
  if (film.enwiki) return film.enwiki.replace(/\s*\((?:[^()]*\s)?film\)$/i, '');
  if (film.label && !/^Q\d+$/.test(film.label)) return film.label;
  return null;
}

function yearFrom(film) {
  if (film.date) return Number(film.date.slice(0, 4));
  const m = film.enwiki?.match(/\((\d{4})\b[^)]*film\)/i);
  return m ? Number(m[1]) : null;
}

async function main() {
  const wd = await read('wikidata.json');
  const wikipedia = await read('wikipedia.json');
  const wp = wikipedia.pages;
  const { perUsd, date: rateDate } = await read('rates.json');
  const history = await read('history.json').catch(() => ({ films: {}, revs: {} }));

  const toUsd = (amount, currency) => (perUsd[currency] ? amount / perUsd[currency] : null);
  const money = (amount, currency, extra = {}) => {
    const usd = toUsd(amount, currency);
    if (!usd || usd < MIN_USD || usd > MAX_USD) return null;
    const inr = currency === 'INR' ? amount : usd * perUsd.INR;
    return { amount, currency, usd: Math.round(usd), inr: Math.round(inr), ...extra };
  };

  // Pick one Wikidata statement: newest "point in time" first, otherwise the largest.
  const pick = (statements, filter) => {
    const list = (statements || []).filter((s) => s.currency && filter(s));
    if (!list.length) return null;
    list.sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') ||
      (toUsd(b.amount, b.currency) || 0) - (toUsd(a.amount, a.currency) || 0)
    );
    const s = list[0];
    return money(s.amount, s.currency, { source: 'wikidata', asOf: s.date });
  };

  // Hand-checked fixes for infobox grosses the parser misreads (data/gross-overrides.json).
  // Each applies only while the infobox text is unchanged, so a later Wikipedia edit wins.
  const overrides = JSON.parse(await readFile(new URL('../data/gross-overrides.json', import.meta.url), 'utf8'));
  const usedOverrides = new Set();
  const correctedGross = (field, film) => {
    const fix = overrides[film.qid];
    if (!fix || !field) return field;
    if (field.text !== fix.text) return field;
    usedOverrides.add(film.qid);
    return { ...field, low: fix.low, high: fix.high ?? fix.low, approx: fix.approx ?? field.approx };
  };

  const fromWikipedia = (field, film) => {
    if (!field?.currency) return null;
    let currency = field.currency;
    // "¥" on a Chinese film means yuan, not yen.
    const countries = countriesFrom(film, wp[film.enwiki]);
    if (currency === 'JPY' && countries.includes('CN') && !countries.includes('JP')) currency = 'CNY';
    return money(field.low, currency, {
      low: field.low, high: field.high, approx: Boolean(field.approx), source: 'wikipedia', text: field.text,
    });
  };

  // Vandalism guard. Films linked from Wikipedia's highest-grossing list pages (fetch-lists.mjs):
  // an Indian film claiming ₹500 crore+, or any film claiming $1.2 billion+, must be on one.
  // Films released in the last 120 days are trusted, because the lists lag behind new hits.
  const lists = await read('lists.json').catch(() => null);
  const listed = lists?.indian?.length > 100 && lists?.worldwide?.length > 100
    ? { indian: new Set(lists.indian), worldwide: new Set(lists.worldwide) }
    : null;
  if (!listed) console.warn('No data/raw/lists.json: big figures are not cross-checked (run node scripts/fetch-lists.mjs).');
  const now = Date.now();
  const isRecent = (film) => {
    const age = now - Date.parse(film.date);
    return Boolean(film.date) && !film.date.endsWith('-01-01') && age >= 0 && age < 120 * DAY;
  };
  const rejected = [];
  // IMDb user ratings (fetch-ratings.mjs). Optional: without the file, films simply have no rating.
  // Only with IMDB_RATINGS=1 (README "IMDb ratings"): IMDb's free dataset is for non-commercial use.
  const imdbRatings = process.env.IMDB_RATINGS === '1' ? (await read('ratings.json').catch(() => null))?.ratings ?? {} : {};
  // A handful of votes is noise, so a rating is only shown once enough people have voted.
  const MIN_VOTES = 100;
  const ratingOf = (imdb) => {
    const r = imdb && imdbRatings[imdb];
    return r && r.votes >= MIN_VOTES ? { value: r.rating, votes: r.votes } : null;
  };

  const films = [];
  const slugs = new Set();
  let fromWp = 0;
  let fromWd = 0;

  for (const film of Object.values(wd.films)) {
    const title = titleFrom(film);
    if (!title) continue;
    const page = film.enwiki ? wp[film.enwiki] : null;
    const statements = wd.boxOffice[film.qid];
    const countries = countriesFrom(film, page);
    const languages = languagesFrom(film, page);

    // 'bad': an unbacked huge figure. 'abroad': a co-production (Kung Fu Yoga, Gandhi) that is not on
    // the Indian lists, so it is ranked with foreign films instead of topping the Indian chart.
    const verdict = (g) => {
      if (!listed || isRecent(film)) return 'ok';
      if (g.usd >= 1.2e9 && !listed.worldwide.has(film.enwiki)) return 'bad';
      if (isIndianFilm({ countries, languages }, g) && g.inr >= 5e9 && !listed.indian.has(film.enwiki)) {
        return countries.some((c) => c !== 'IN') ? 'abroad' : 'bad';
      }
      return 'ok';
    };

    // Wikipedia first: its infobox is watched by editors and, for Indian films, is in rupees as
    // reported. Wikidata is the fallback; its Indian figures in particular are often stale,
    // in dollars, or mistyped (e.g. ₹47 crore entered as ₹4,712 crore).
    const wdWorld = pick(statements, (s) => s.place === PLACE.WORLDWIDE);
    const candidates = [fromWikipedia(correctedGross(page?.gross, film), film), wdWorld, pick(statements, (s) => !s.place)].filter(Boolean);
    const gross = candidates.find((g) => verdict(g) !== 'bad');
    if (candidates.length && candidates[0] !== gross) {
      rejected.push(`${title}: ${candidates[0].text || `${candidates[0].currency} ${candidates[0].amount}`}${gross ? ' (used Wikidata instead)' : ''}`);
    }
    if (!gross) continue;
    // Wikipedia's infobox gross and Wikidata's "worldwide" statements are worldwide totals;
    // a Wikidata figure without a place could be anything, so it is labelled more loosely.
    gross.scope = gross === wdWorld || gross.source === 'wikipedia' ? 'worldwide' : 'unspecified';
    if (gross.source === 'wikipedia') fromWp++;
    else fromWd++;

    const year = yearFrom(film);
    let slug = slugify(`${title}${year ? `-${year}` : ''}`) || film.qid.toLowerCase();
    if (slugs.has(slug)) slug = `${slug}-${film.qid.toLowerCase()}`;
    slugs.add(slug);

    const budget =
      fromWikipedia(page?.budget, film) ||
      pick(wd.budget[film.qid], () => true);

    films.push({
      id: film.qid,
      slug,
      title,
      year,
      indian: isIndianFilm({ countries, languages }, gross) && verdict(gross) !== 'abroad',
      // Wikidata's earliest date, or the earliest date that year known to the day when it is only a year (the
      // year and the page address still come from the earliest date, so they don't change).
      date: dayDate(film),
      countries,
      languages,
      directors: film.directors.slice(0, 3),
      starring: page?.starring || [],
      runtime: film.runtime,
      imdb: film.imdb,
      rating: ratingOf(film.imdb),
      enwiki: film.enwiki,
      gross,
      // A single country's take can't be more than the worldwide total; if it is, one of the
      // two figures is wrong, so the country figure is dropped.
      domestic: belowGross(pick(statements, (s) => s.place === PLACE.US || s.place === PLACE.NORTH_AMERICA), gross),
      india: belowGross(pick(statements, (s) => s.place === PLACE.INDIA), gross),
      budget: budget && budget.usd < 1e9 ? budget : null,
      ...dailyAndLive(gross, history.films[film.enwiki], history.revs),
    });
  }

  films.sort((a, b) => b.gross.usd - a.gross.usd);
  films.forEach((f, i) => (f.rank = i + 1));

  // ---------- upcoming: films due in cinemas in the next 60 days, or out in the last week with no figure yet ----------
  // `release` is the first of the film's Wikidata dates in that window, so a festival premiere months ago doesn't
  // hide a cinema release still to come. Slugs are given out after the films', so no film's address changes, and
  // when an upcoming film gets its first figure its page stays at the same address.
  const todayIst = new Date(now + IST_OFFSET).toISOString().slice(0, 10);
  const shift = (days) => new Date(Date.parse(`${todayIst}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
  const windowStart = shift(-6);
  const windowEnd = shift(60);
  const tooOld = shift(-400);
  const MIN_SITELINKS = 4; // first shown more than a year ago: a re-release or a late foreign release, not a new film
  const listedFilms = new Set(films.map((f) => f.id));
  const upcoming = [];
  for (const film of Object.values(wd.films)) {
    if (listedFilms.has(film.qid) || !film.enwiki || wd.boxOffice[film.qid]) continue;
    const page = wp[film.enwiki];
    if (!page || page.missing || page.gross?.currency) continue;
    // `dates`: every date Wikidata has to the day (older downloads lack it: fall back to the earliest date).
    const dates = (Array.isArray(film.dates) ? film.dates : [film.date]).filter((d) => d && !d.endsWith('-01-01')).sort();
    const release = dates.find((d) => d >= windowStart && d <= windowEnd);
    if (!release || (film.date && film.date < tooOld)) continue;
    const distributors = [...new Set([...(page.distributor || []), ...(film.distributors || [])])];
    if (distributors.length && distributors.every((d) => STREAMING.test(d.trim()))) continue;
    const title = titleFrom(film);
    if (!title) continue;
    const countries = countriesFrom(film, page);
    const languages = languagesFrom(film, page);
    const indian = countries.length ? isIndianFilm({ countries, languages }, {}) : languages.some((l) => INDIAN_LANGUAGES.has(l));
    // International films need articles in a few Wikipedia languages, which keeps out small festival titles.
    // Indian films often have only one or two, so every one is kept.
    if (!indian && (film.sitelinks || 0) < MIN_SITELINKS) continue;
    const year = yearFrom(film);
    let slug = slugify(`${title}${year ? `-${year}` : ''}`) || film.qid.toLowerCase();
    if (slugs.has(slug)) slug = `${slug}-${film.qid.toLowerCase()}`;
    slugs.add(slug);
    const budget = fromWikipedia(page.budget, film) || pick(wd.budget[film.qid], () => true);
    upcoming.push({
      id: film.qid,
      slug,
      title,
      year,
      indian,
      release,
      date: film.date,
      countries,
      languages,
      directors: film.directors.slice(0, 3),
      starring: page.starring || [],
      runtime: film.runtime,
      imdb: film.imdb,
      enwiki: film.enwiki,
      budget: budget && budget.usd < 1e9 ? budget : null,
      distributors: distributors.slice(0, 4),
      sitelinks: film.sitelinks || 0,
    });
  }
  upcoming.sort((a, b) => a.release.localeCompare(b.release) || b.sitelinks - a.sitelinks);

  await writeFile(
    new URL('../data/movies.json', import.meta.url),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      sources: { wikipedia: wikipedia.fetchedAt },
      rates: { date: rateDate, inrPerUsd: perUsd.INR },
      films,
      upcoming,
    })
  );
  console.log(
    `Merged ${films.length} films with a box office figure (Wikipedia: ${fromWp}, Wikidata: ${fromWd}) → data/movies.json`
  );
  console.log(`Upcoming: ${upcoming.length} films due in cinemas by ${windowEnd} (or out since ${windowStart} with no figure yet).`);
  const stale = Object.keys(overrides).filter((qid) => qid.startsWith('Q') && !usedOverrides.has(qid));
  if (stale.length) {
    console.warn(`Unused gross overrides (infobox changed or film missing), check data/gross-overrides.json:\n  ${
      stale.map((qid) => `${qid} ${overrides[qid].title}`).join('\n  ')}`);
  }
  if (rejected.length) console.log(`Rejected ${rejected.length} figures not backed by Wikipedia's highest-grossing lists:\n  ${rejected.join('\n  ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
