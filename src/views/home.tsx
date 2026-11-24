import type { Metadata } from 'next';
import { Money } from '@/components/client/basics';
import { CardDay, CardGross } from '@/components/client/FilmCardLive';
import { LatestSpotlight, type SpotSlide } from '@/components/client/LatestSpotlight';
import { SearchBox } from '@/components/client/SearchBox';
import { PairCards } from '@/components/client/compare/PairCards';
import { HOME_SEARCH, PageShell } from '@/components/PageShell';
import { GUIDES } from '@/content/guides';
import { Ad, FaqBlock, FilmLink, Html, JsonLd, Poster, RankList } from '@/components/ui';
import {
  bannerUrl, BUILD_TIME, byYear, wikiPosterUrl, CLUBS, inCinemas, indian, languageByName, languageBySlug, languages, nativeOf, NOW_YEAR, posterUrl, releaseOf,
  sourcesCheckedAt, STATS, todayRank, trending, yearsSorted,
} from '@/lib/data';
import { runDay } from '@/lib/film-stats';
import { formatCount } from '@/lib/format';
import { CPI_YEAR } from '@/lib/inflation';
import { comparePairs, languageRace } from '@/lib/insights';
import { alternatesFor, CONTENT, localePath, type Lang } from '@/lib/i18n';
import { faqLd, pageMetadata } from '@/lib/seo';
import { SITE } from '@/lib/site';
import type { Film, Language } from '@/lib/types';
import { GuideCards } from './guides';
import { TrendingShelf } from './trending';
import { homeUpcoming, UpcomingShelf } from './upcoming';
import { WorldwideNote, worldwideTop } from './shared';

export const langName = (lang: Lang, l: Language) => (lang === 'hi' ? l.hi : l.name);

/** A language as a film industry, by the name people search for: Hindi is Bollywood, English is Hollywood. */
const INDUSTRY: Record<string, Record<Lang, string>> = { hindi: { en: 'Bollywood', hi: 'बॉलीवुड' }, english: { en: 'Hollywood', hi: 'हॉलीवुड' } };
const industryName = (lang: Lang, l: Language) => INDUSTRY[l.slug]?.[lang] ?? langName(lang, l);
/** Industries linked from the home page: the biggest Indian languages, then Hollywood. */
const INDUSTRY_LINKS = 8;


const Pin = () => <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14.5s4.5-4.2 4.5-7.8a4.5 4.5 0 0 0-9 0c0 3.6 4.5 7.8 4.5 7.8Z" /><circle cx="8" cy="6.6" r="1.6" /></svg>;

/**
 * A film in cinemas, kept to what a reader scans for: title, day of the run, today's rank, and the worldwide
 * total (live) with today's gain. Release date, budget, rating and the India/overseas split are on its page.
 */
function FilmCard({ film: f, lang, origin = false, reveal = true }: { film: Film; lang: Lang; origin?: boolean; reveal?: boolean }) {
  const t = CONTENT[lang].ui.card;
  const showing = inCinemas.includes(f);
  const release = f.daily?.length ? releaseOf(f) : f.date;
  const rank = todayRank.get(f.id);
  const backdrop = posterUrl(f, 330);
  return (
    // Cards in the closed "show more" list skip the scroll reveal: it would leave them hidden when opened.
    <li className="film-card" data-reveal={reveal ? '' : undefined}>
      {/* The poster itself, blurred into a wash of its colours (same file as the poster, so no extra download). */}
      {backdrop ? <img className="fc-backdrop" src={backdrop} alt="" aria-hidden="true" loading="lazy" decoding="async" /> : null}
      <div className="fc-head">
        <Poster film={f} />
        <div className="fc-title">
          <h3>
            <a className="fc-link" href={`/movie/${f.slug}/`}>{f.title}</a>
            {showing && release ? <span className="fc-day"><span className="live-dot" aria-hidden="true" /><CardDay release={release} initial={runDay(release, BUILD_TIME)} /></span> : null}
            {rank ? <span className="fc-rank">{t.rankToday(rank)}</span> : null}
          </h3>
        </div>
        {origin ? <span className="fc-origin"><Pin />{f.indian ? t.indian : t.international}</span> : null}
      </div>
      <div className="fc-figures">
        <div className="fc-main">
          <p className="fc-label">{t.worldwide}</p>
          <CardGross gross={{ usd: f.gross.usd, inr: f.gross.inr }} native={nativeOf(f)} live={f.live ?? null} />
        </div>
      </div>
    </li>
  );
}

/** Cards per group shown at first on the home page board; the rest open below with "Show more". */
const CARDS_PER_GROUP = 4;

/** Cards in the home page's "Trending this week" row, at least this many of them Indian and international each. */
const TRENDING_CARDS = 12;
const TRENDING_EACH_KIND = 3;

/** The first `n` of `list`, swapping in up to `min` Indian and `min` international films when one kind is short. */
function bothKinds<T>(list: T[], n: number, isIndian: (x: T) => boolean, min = 2): T[] {
  const pick = list.slice(0, n);
  for (const kind of [true, false]) {
    const want = Math.min(min, list.filter((f) => isIndian(f) === kind).length);
    const waiting = list.filter((f) => isIndian(f) === kind && !pick.includes(f));
    while (pick.filter((f) => isIndian(f) === kind).length < want && waiting.length) {
      const drop = pick.map(isIndian).lastIndexOf(!kind); // the lowest-placed film of the other kind
      if (drop < 0) break;
      pick.splice(drop, 1);
      pick.push(waiting.shift()!);
    }
  }
  return pick.sort((a, b) => list.indexOf(a) - list.indexOf(b));
}

export function homeMetadata(lang: Lang): Metadata {
  const home = CONTENT[lang].home(STATS);
  return pageMetadata({ lang, path: localePath(lang, '/'), title: home.title, description: home.description, alternates: alternatesFor('/') });
}

export function HomePage({ lang }: { lang: Lang }) {
  const c = CONTENT[lang];
  const ui = c.ui;
  const P = (path: string) => localePath(lang, path);
  const home = c.home(STATS);
  const hero = c.hero(STATS);

  // "In cinemas now" board: the films on the /live/ page (running live estimates first, then the rest by
  // reported total), as two groups, Indian and international. With none in cinemas: the year's biggest.
  const showing = inCinemas.length > 0;
  const boardYear = byYear.get(NOW_YEAR)?.length ? NOW_YEAR : yearsSorted[0];
  const yearFilms = (byYear.get(boardYear) || []).slice(0, 8);
  const groups = [
    { key: 'indian', title: ui.boardGroups.indian, films: inCinemas.filter((f) => f.indian) },
    { key: 'international', title: ui.boardGroups.international, films: inCinemas.filter((f) => !f.indian) },
  ];
  const checkedLabel = sourcesCheckedAt && new Date(sourcesCheckedAt).toLocaleString(c.htmlLang, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });

  // "Coming soon": one row of posters, the best-known Indian and international films still to come.
  const soon = homeUpcoming();

  // The spotlight: the most-read films in cinemas that have a poster (up to 5, both Indian and international
  // ones). Films without page view figures keep their board order (today's business) after the rest.
  const viewsById = new Map(trending.map((t) => [t.film.id, t.views]));
  const byViews = (list: Film[]) => [...list].sort((a, b) => (viewsById.get(b.id) ?? 0) - (viewsById.get(a.id) ?? 0));
  const spotFilms = showing
    ? bothKinds(byViews(inCinemas.filter((f) => posterUrl(f, 500))), 5, (f) => f.indian)
    : byViews(yearFilms.filter((f) => posterUrl(f, 500))).slice(0, 5);

  // "Trending this week": the most-read recent and upcoming films, the first thing below the search.
  const hot = bothKinds(trending, TRENDING_CARDS, (t) => t.film.indian, TRENDING_EACH_KIND);
  const spotSlides: SpotSlide[] = spotFilms.map((f) => {
    const l0 = f.languages.map((name) => languageByName.get(name)).find(Boolean);
    const release = f.daily?.length ? releaseOf(f) : f.date;
    const released = f.date && !f.date.endsWith('-01-01')
      ? new Date(`${f.date}T00:00:00Z`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      : null;
    return {
      slug: f.slug, title: f.title, poster: posterUrl(f, 500), thumb: posterUrl(f, 120), banner: bannerUrl(f) || null, fallback: wikiPosterUrl(f, 500),
      meta: [l0 ? langName(lang, l0) : f.languages[0], released, f.directors[0]].filter((x): x is string => Boolean(x)),
      gross: { usd: f.gross.usd, inr: f.gross.inr }, native: nativeOf(f), live: f.live ?? null,
      release, showing: inCinemas.includes(f), rank: todayRank.get(f.id) ?? null, rating: f.rating?.value ?? null, votes: f.rating?.votes ?? null,
    };
  });

  // "Browse box office collection": industry charts (Bollywood first, Hollywood last) and the last ten years.
  const hollywood = languageBySlug.get('english');
  const industries = [...languages.filter((l) => l.native === 'INR').slice(0, INDUSTRY_LINKS), ...(hollywood ? [hollywood] : [])];
  const browseYears = yearsSorted.filter((y) => y <= NOW_YEAR).slice(0, 10);

  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: `${SITE.url}${P('/')}`,
      inLanguage: c.htmlLang, description: home.description,
      publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url, logo: `${SITE.url}/icon-512.png` },
    },
  ];

  return (
    <PageShell lang={lang} alternates={alternatesFor('/')} headerSearch={false}>
      <JsonLd data={jsonld} />
      {/* The top banner: the page heading and search, over a slider of the latest releases. */}
      <LatestSpotlight slides={spotSlides} header={(
        <>
          <div className="spot-heading">
            <p className="hero-kicker"><span />{hero.kicker}</p>
            <Html as="h1" html={hero.h1Html.replace(/<br\s*\/?>/g, ' ')} />
          </div>
          <SearchBox variant="big" id={HOME_SEARCH} label={ui.searchLabel} placeholder={ui.searchPlaceholderBig} />
        </>
      )} />
      <div className="catalog-status">
        <span><b>{formatCount(STATS.films)}</b> {hero.filmsTracked}</span>
        {checkedLabel ? <span>{hero.updated} <time dateTime={sourcesCheckedAt!}>{checkedLabel} IST</time></span> : null}
      </div>

      {hot.length ? (
        <section className="release-section" aria-labelledby="trending">
          {/* The one note on the page: the row's order isn't box office, so it says what it is. */}
          <div className="release-head">
            <div>
              <h2 id="trending">{ui.trendingTitle}</h2>
              <p>{ui.trendingNote}</p>
            </div>
          </div>
          <TrendingShelf items={hot} lang={lang} />
        </section>
      ) : null}

      {soon.length ? (
        <section className="release-section" aria-labelledby="soon">
          <div className="release-head">
            <h2 id="soon">{ui.upcomingTitle}</h2>
            <a className="see-all" href={P('/upcoming/')}>{ui.upcomingSeeAll} <span aria-hidden="true">›</span></a>
          </div>
          <UpcomingShelf films={soon} lang={lang} />
        </section>
      ) : null}

      <section className="release-section" aria-labelledby="now">
        <div className="release-head">
          <h2 id="now">{showing ? ui.boardTitle : ui.boardFallback(boardYear)}</h2>
          {showing
            ? <a className="see-all" href={P('/live/')}>{hero.seeAllLive} <span aria-hidden="true">›</span></a>
            : <a className="see-all" href={P(`/year/${boardYear}/`)}>{boardYear} {hero.chart} <span aria-hidden="true">›</span></a>}
        </div>
        {showing ? groups.map((g) => (
          <div className="release-group" key={g.key}>
            <h3 id={`now-${g.key}`}>{g.title} <span className="release-count">{formatCount(g.films.length)}</span></h3>
            {g.films.length ? (
              <ol className="film-cards" aria-labelledby={`now-${g.key}`}>
                {g.films.slice(0, CARDS_PER_GROUP).map((f) => <FilmCard key={f.id} film={f} lang={lang} />)}
              </ol>
            ) : <p className="release-empty">{ui.boardEmpty}</p>}
            {g.films.length > CARDS_PER_GROUP ? (
              <details className="release-more">
                <summary>
                  <span className="when-closed">{ui.boardMore(g.films.length - CARDS_PER_GROUP)}</span>
                  <span className="when-open">{ui.boardLess}</span>
                </summary>
                <ol className="film-cards" start={CARDS_PER_GROUP + 1} aria-labelledby={`now-${g.key}`}>
                  {g.films.slice(CARDS_PER_GROUP).map((f) => <FilmCard key={f.id} film={f} lang={lang} reveal={false} />)}
                </ol>
              </details>
            ) : null}
          </div>
        )) : (
          <ol className="film-cards">
            {yearFilms.map((f) => <FilmCard key={f.id} film={f} lang={lang} origin />)}
          </ol>
        )}
      </section>

      <Ad lang={lang} />

      <section aria-labelledby="clubs">
        <h2 id="clubs">{ui.clubsTitle}</h2>
        <div className="clubs">
          {CLUBS.map((club) => (
            <a className="club" key={club.slug} href={P(`/club/${club.slug}/`)} data-reveal="">
              <b data-countup={club.list.length}>{formatCount(club.list.length)}</b><span>{ui.clubCount(c.club[club.slug].label)}</span>
            </a>
          ))}
        </div>
      </section>

      <div className="columns">
        <section aria-labelledby="top-india">
          <div className="release-head">
            <h2 id="top-india">{ui.topIndia}</h2>
            <a className="see-all" href={P('/india/')}>{ui.seeAll} <span aria-hidden="true">›</span></a>
          </div>
          <RankList list={indian.slice(0, 10)} native="INR" live />
          {CPI_YEAR ? <a className="more" href={P('/india/adjusted/')}>{ui.adjustedLink}</a> : null}
        </section>
        <section aria-labelledby="top-world">
          <div className="release-head">
            <h2 id="top-world">{ui.topWorld}</h2>
            <a className="see-all" href={P('/top/')}>{ui.seeAll} <span aria-hidden="true">›</span></a>
          </div>
          <RankList list={worldwideTop(10)} native="USD" />
          {/* Where the chart comes from, kept under the list instead of above it. */}
          <WorldwideNote lang={lang} className="list-source" />
        </section>
      </div>

      <section aria-labelledby="browse">
        <h2 id="browse">{ui.browseTitle}</h2>
        <h3 className="browse-label">{ui.browseIndustry}</h3>
        <ul className="chips">
          {industries.map((l) => (
            <li key={l.slug}><a href={P(`/language/${l.slug}/`)}>{industryName(lang, l)}<small>{formatCount(l.list.length)}</small></a></li>
          ))}
        </ul>
        <h3 className="browse-label">{ui.browseYear}</h3>
        <ul className="chips">
          {browseYears.map((y) => <li key={y}><a href={P(`/year/${y}/`)}>{y}</a></li>)}
        </ul>
        <a className="more" href={P('/explore/')}>{ui.explore}</a>
      </section>
    </PageShell>
  );
}

/** "2026 box office race by language": this year's Indian releases, totalled by original language (on /explore/). */
function LanguageRace({ lang }: { lang: Lang }) {
  const ui = CONTENT[lang].ui;
  const P = (path: string) => localePath(lang, path);
  const race = languageRace();
  if (!race) return null;
  const raceMax = race.rows[0].total.inr || 1;
  return (
    <section aria-labelledby="race">
      <h2 id="race">{ui.raceTitle(race.year)}</h2>
      <p className="section-note">{ui.raceNote}</p>
      <ol className="ranks race">
        {race.rows.map((r, i) => (
          <li key={r.language.slug}>
            <span className="n">{i + 1}</span>
            <span className="t">
              <span>
                <a href={P(`/language/${r.language.slug}/`)}>{langName(lang, r.language)}</a>
                <small>{ui.filmsCount(r.count)} · {ui.raceTop}: {r.top.title}</small>
              </span>
            </span>
            <span className="v"><Money {...r.total} native="INR" /></span>
            <span className="bar" aria-hidden="true"><i style={{ width: `${Math.max(1, Math.round((r.total.inr / raceMax) * 100))}%` }} /></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** "Compare any two films": three ready-made pairs and a link to /compare/ (on /explore/). */
function ComparePairs({ lang }: { lang: Lang }) {
  const ui = CONTENT[lang].ui;
  const pairs = comparePairs(3);
  if (!pairs.length) return null;
  return (
    <section aria-labelledby="compare">
      <div className="release-head">
        <div>
          <h2 id="compare">{ui.compareTitle}</h2>
          <p>{ui.compareNote}</p>
        </div>
        <a className="see-all" href="/compare/" hrefLang={lang === 'en' ? undefined : 'en'}>{ui.compareOpen} <span aria-hidden="true">›</span></a>
      </div>
      <PairCards pairs={pairs} labels={lang === 'en'} />
    </section>
  );
}

// ---------- /explore/: sections moved off the home page ----------

export function exploreMetadata(lang: Lang): Metadata {
  const p = CONTENT[lang].pages.explore(STATS);
  return pageMetadata({ lang, path: localePath(lang, '/explore/'), title: `${p.title} | ${SITE.name}`, description: p.description, alternates: alternatesFor('/explore/') });
}

export function ExplorePage({ lang }: { lang: Lang }) {
  const c = CONTENT[lang];
  const ui = c.ui;
  const P = (path: string) => localePath(lang, path);
  const p = c.pages.explore(STATS);

  const years: number[] = [];
  for (let y = NOW_YEAR; y >= NOW_YEAR - 15; y--) if (byYear.get(y)?.length) years.push(y);

  const faq = c.faq(STATS);

  return (
    <PageShell lang={lang} alternates={alternatesFor('/explore/')}>
      <JsonLd data={faqLd(faq)} />
      <div className="page-head"><h1>{p.h1}</h1><Html as="p" html={p.intro} /></div>

      <LanguageRace lang={lang} />
      <ComparePairs lang={lang} />

      <section aria-labelledby="by-year">
        <h2 id="by-year">{ui.byYear}</h2>
        <ul className="years">
          {years.map((y) => {
            const f = byYear.get(y)![0];
            return (
              <li key={y} data-reveal="">
                <span className="y"><a href={P(`/year/${y}/`)}>{y}</a></span>
                <span><FilmLink film={f} /><small><Money {...f.gross} native={nativeOf(f)} /></small></span>
              </li>
            );
          })}
        </ul>
        <a className="more" href={P('/years/')}>{ui.everyYear}</a>
      </section>

      <section aria-labelledby="by-language">
        <h2 id="by-language">{ui.byLanguage}</h2>
        <ul className="chips">
          {languages.slice(0, 24).map((l) => (
            <li key={l.slug} data-reveal=""><a href={P(`/language/${l.slug}/`)}>{industryName(lang, l)}<small>{l.list.length}</small></a></li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="guides">
        <h2 id="guides">{ui.guidesTitle}</h2>
        <p className="section-note">{ui.guidesNote}</p>
        {/* The guides are written in English. */}
        <GuideCards guides={GUIDES.slice(0, 6)} lang={lang === 'en' ? undefined : 'en'} />
        <a className="more" href="/guides/" hrefLang={lang === 'en' ? undefined : 'en'}>{ui.allGuides}</a>
      </section>

      <Html as="article" className="article prose" aria-labelledby="guide" html={c.article(STATS)} data-reveal="" />

      <FaqBlock items={faq} heading={ui.faqTitle} />
    </PageShell>
  );
}
