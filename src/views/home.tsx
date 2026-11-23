import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Money } from '@/components/client/basics';
import { CardDay, CardGross } from '@/components/client/FilmCardLive';
import { LatestSpotlight, type SpotSlide } from '@/components/client/LatestSpotlight';
import { SearchBox } from '@/components/client/SearchBox';
import { PairCards } from '@/components/client/compare/PairCards';
import { ImdbRating } from '@/components/ImdbRating';
import { HOME_SEARCH, PageShell } from '@/components/PageShell';
import { GUIDES } from '@/content/guides';
import { Ad, FaqBlock, FilmLink, Html, JsonLd, Poster, RankList } from '@/components/ui';
import {
  bannerUrl, BUILD_TIME, byYear, wikiPosterUrl, CLUBS, inCinemas, indian, languageByName, languages, marketsOf, nativeOf, NOW_YEAR, nowShowing, posterUrl, releaseOf,
  sourcesCheckedAt, STATS, todayRank, yearsSorted,
} from '@/lib/data';
import { runDay } from '@/lib/film-stats';
import { formatCount } from '@/lib/format';
import { CPI_YEAR } from '@/lib/inflation';
import { comparePairs, languageRace } from '@/lib/insights';
import { alternatesFor, CONTENT, localePath, type Lang } from '@/lib/i18n';
import { absoluteLinks, pageMetadata } from '@/lib/seo';
import { SITE } from '@/lib/site';
import type { Film, Language, Money as MoneyValue } from '@/lib/types';
import { GuideCards } from './guides';
import { WorldwideNote, worldwideTop } from './shared';

export const langName = (lang: Lang, l: Language) => (lang === 'hi' ? l.hi : l.name);


const Pin = () => <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14.5s4.5-4.2 4.5-7.8a4.5 4.5 0 0 0-9 0c0 3.6 4.5 7.8 4.5 7.8Z" /><circle cx="8" cy="6.6" r="1.6" /></svg>;

/**
 * A recent release with everything a reader would open its page for: release date, day of the run, today's
 * rank, budget, IMDb rating, and the worldwide total (live) next to its India and overseas parts.
 */
function FilmCard({ film: f, lang }: { film: Film; lang: Lang }) {
  const c = CONTENT[lang];
  const t = c.ui.card;
  const native = nativeOf(f);
  const showing = inCinemas.includes(f);
  const release = f.daily?.length ? releaseOf(f) : f.date;
  const rank = todayRank.get(f.id);

  // The parts of the worldwide total: India and overseas for Indian films (as stated on Wikipedia,
  // src/lib/data.ts marketsOf), North America and the rest for others.
  const parts: { label: string; value: MoneyValue }[] = [];
  if (f.indian) {
    const m = marketsOf(f);
    if (m?.indiaNet) parts.push({ label: t.indiaNet, value: m.indiaNet });
    else if (m?.indiaGross) parts.push({ label: t.indiaGross, value: m.indiaGross });
    if (m?.overseas) parts.push({ label: t.overseas, value: m.overseas });
  } else if (f.domestic && f.domestic.usd < f.gross.usd) {
    parts.push({ label: t.northAmerica, value: f.domestic });
    parts.push({ label: t.overseas, value: { usd: f.gross.usd - f.domestic.usd, inr: f.gross.inr - f.domestic.inr } });
  }

  const meta: ReactNode[] = [];
  if (f.date && !f.date.endsWith('-01-01')) {
    const date = new Date(`${f.date}T00:00:00Z`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    meta.push(t.released(date));
  }
  if (f.budget) meta.push(<>{t.budget} <Money usd={f.budget.usd} inr={f.budget.inr} native={native} /></>);
  if (f.rating) meta.push(<ImdbRating value={f.rating.value} votes={f.rating.votes} />);

  const backdrop = posterUrl(f, 330);
  return (
    <li className="film-card" data-reveal="">
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
          {meta.length ? <p className="fc-meta"><span className="fc-meta-row">{meta.map((m, i) => <span key={i}>{m}</span>)}</span></p> : null}
        </div>
        <span className="fc-origin"><Pin />{f.indian ? t.indian : t.international}</span>
      </div>
      <div className="fc-figures">
        <div className="fc-main">
          <p className="fc-label">{t.worldwide}</p>
          <CardGross gross={{ usd: f.gross.usd, inr: f.gross.inr }} native={native} live={f.live ?? null} />
        </div>
        {parts.map((p) => (
          <div className="fc-part" key={p.label}>
            <p className="fc-label">{p.label}</p>
            <p className="fc-value"><Money usd={p.value.usd} inr={p.value.inr} native={native} /></p>
          </div>
        ))}
      </div>
    </li>
  );
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

  // "Recent releases" board: films out in the last 60 days, or the current year's biggest.
  const hasRecent = nowShowing.length > 0;
  const boardYear = byYear.get(NOW_YEAR)?.length ? NOW_YEAR : yearsSorted[0];
  const boardFilms = hasRecent ? nowShowing : (byYear.get(boardYear) || []).slice(0, 8);
  const boardTitle = hasRecent ? hero.browse : ui.boardFallback(boardYear);
  const checkedLabel = sourcesCheckedAt && new Date(sourcesCheckedAt).toLocaleString(c.htmlLang, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });

  // The spotlight: the newest films in cinemas that have a poster (up to 5).
  const spotSlides: SpotSlide[] = boardFilms.filter((f) => posterUrl(f, 500)).slice(0, 5).map((f) => {
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

  const race = languageRace();
  const raceMax = race?.rows[0].total.inr || 1;
  const pairs = comparePairs(3);

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

      <section className="release-section" aria-labelledby="now">
        <div className="release-head">
          <div>
            <h2 id="now">{boardTitle}</h2>
            <p>{hasRecent ? ui.boardNote : ui.boardFallbackNote}</p>
          </div>
          {hasRecent
            ? <a className="see-all" href={P('/live/')}>{hero.seeAllLive} <span aria-hidden="true">›</span></a>
            : <a className="see-all" href={P(`/year/${boardYear}/`)}>{boardYear} {hero.chart} <span aria-hidden="true">›</span></a>}
        </div>
        <ol className="film-cards">
          {boardFilms.map((f) => <FilmCard key={f.id} film={f} lang={lang} />)}
        </ol>
      </section>

      <Ad lang={lang} />

      <section aria-labelledby="clubs">
        <h2 id="clubs">{ui.clubsTitle}</h2>
        <p className="section-note">{ui.clubsNote}</p>
        <div className="clubs">
          {CLUBS.map((club) => (
            <a className="club" key={club.slug} href={P(`/club/${club.slug}/`)} data-reveal="">
              <b data-countup={club.list.length}>{formatCount(club.list.length)}</b><span>{ui.clubCount(c.club[club.slug].label)}</span>
            </a>
          ))}
        </div>
      </section>

      {race ? (
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
      ) : null}

      {pairs.length ? (
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
      ) : null}

      <div className="columns">
        <section aria-labelledby="top-india">
          <h2 id="top-india">{ui.topIndia}</h2>
          <p className="section-note">{ui.topIndiaNote}</p>
          <RankList list={indian.slice(0, 10)} native="INR" live />
          <a className="more" href={P('/india/')}>{ui.allIndian}</a>
          {CPI_YEAR ? <a className="more more-2" href={P('/india/adjusted/')}>{ui.adjustedLink}</a> : null}
        </section>
        <section aria-labelledby="top-world">
          <h2 id="top-world">{ui.topWorld}</h2>
          <WorldwideNote lang={lang} className="section-note" />
          <RankList list={worldwideTop(10)} native="USD" />
          <a className="more" href={P('/top/')}>{ui.top500}</a>
        </section>
      </div>

      <p className="explore-link"><a className="more" href={P('/explore/')}>{ui.explore} <span aria-hidden="true">›</span></a></p>
    </PageShell>
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
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: absoluteLinks(a) } })),
  };

  return (
    <PageShell lang={lang} alternates={alternatesFor('/explore/')}>
      <JsonLd data={jsonld} />
      <div className="page-head"><h1>{p.h1}</h1><Html as="p" html={p.intro} /></div>

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
            <li key={l.slug} data-reveal=""><a href={P(`/language/${l.slug}/`)}>{langName(lang, l)}<small>{l.list.length}</small></a></li>
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
