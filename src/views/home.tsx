import type { Metadata } from 'next';
import { Money } from '@/components/client/basics';
import { BoardCollection } from '@/components/client/Live';
import { HeroMotion } from '@/components/client/motion/HeroMotion';
import { SearchBox } from '@/components/client/SearchBox';
import { HeroFeature, type StackFilm } from '@/components/client/three/HeroFeature';
import { PageShell } from '@/components/PageShell';
import { FaqBlock, FilmLink, Html, JsonLd, Poster, RankList } from '@/components/ui';
import {
  artUrl, byYear, CLUBS, indian, languageByName, languages, nativeOf, NOW_YEAR, nowShowing, sourcesCheckedAt, STATS, yearsSorted,
} from '@/lib/data';
import { formatCount } from '@/lib/format';
import { alternatesFor, CONTENT, localePath, type Lang } from '@/lib/i18n';
import { absoluteLinks, pageMetadata } from '@/lib/seo';
import { SITE } from '@/lib/site';
import type { Language } from '@/lib/types';
import { WorldwideNote, worldwideTop } from './shared';

export const langName = (lang: Lang, l: Language) => (lang === 'hi' ? l.hi : l.name);

const Chevron = () => <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>;

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

  const years: number[] = [];
  for (let y = NOW_YEAR; y >= NOW_YEAR - 15; y--) if (byYear.get(y)?.length) years.push(y);

  // "Recent releases" board: films out in the last 60 days, or the current year's biggest.
  const hasRecent = nowShowing.length > 0;
  const boardYear = byYear.get(NOW_YEAR)?.length ? NOW_YEAR : yearsSorted[0];
  const boardFilms = hasRecent ? nowShowing : (byYear.get(boardYear) || []).slice(0, 8);
  const feature = boardFilms.find((f) => artUrl(f, 'backdrop', 'w1280') && artUrl(f, 'poster', 'w342')) || boardFilms[0];
  const backdrop = feature && artUrl(feature, 'backdrop', 'w1280');
  const boardTitle = hasRecent ? hero.browse : ui.boardFallback(boardYear);
  // The hero's featured film, followed by the rest of the board (with posters) in the 3D stack.
  const stackFilms: StackFilm[] = boardFilms
    .filter((f) => f === feature || artUrl(f, 'poster', 'w342'))
    .map((f) => ({ slug: f.slug, title: f.title, poster: artUrl(f, 'poster', 'w342'), gross: { usd: f.gross.usd, inr: f.gross.inr }, native: nativeOf(f) }));
  const stackStart = Math.max(0, stackFilms.findIndex((f) => f.slug === feature?.slug));
  const checkedLabel = sourcesCheckedAt && new Date(sourcesCheckedAt).toLocaleString(c.htmlLang, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });

  const faq = c.faq(STATS);
  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: `${SITE.url}${P('/')}`,
      inLanguage: c.htmlLang, description: home.description,
      publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url, logo: `${SITE.url}/icon-512.png` },
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: absoluteLinks(a) } })),
    },
  ];

  return (
    <PageShell lang={lang} alternates={alternatesFor('/')} headerSearch={false}>
      <JsonLd data={jsonld} />
      <HeroMotion className="hero">
        {backdrop ? <img className="hero-backdrop" src={backdrop} alt="" fetchPriority="high" width={1280} height={720} /> : null}
        <div className="hero-content">
          <p className="hero-kicker"><span />{hero.kicker}</p>
          <Html as="h1" html={hero.h1Html} />
          <Html as="p" className="hero-intro" html={hero.intro} />
          <SearchBox variant="big" label={ui.searchLabel} placeholder={ui.searchPlaceholderBig} />
          <div className="hero-actions">
            <a className="button button-primary" href={P('/live/')}><span className="live-dot" aria-hidden="true" />{hero.live} <Chevron /></a>
            <a className="button button-glass" href={P('/top/')}>{ui.nav.topLong} <Chevron /></a>
          </div>
        </div>
        {feature ? (
          <HeroFeature films={stackFilms} start={stackStart}
            labels={{ featured: hero.featured, reported: hero.reported, ...hero.stack }} />
        ) : null}
      </HeroMotion>
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
        <ol className="movie-grid">
          {boardFilms.map((f, i) => {
            const lang0 = f.languages.map((name) => languageByName.get(name)).find(Boolean);
            const meta = [lang0 ? langName(lang, lang0) : f.languages[0], f.year].filter(Boolean).join(' · ');
            return (
              <li className="movie-card" key={f.id} data-reveal="">
                <a href={`/movie/${f.slug}/`} className="card-link">
                  <Poster film={f} />
                  <span className="card-rank" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <span className="card-title">{f.title}</span>
                  <span className="card-meta">{meta}</span>
                </a>
                <BoardCollection gross={f.gross} native={nativeOf(f)} live={f.live} reported={hero.reported} estimate={hero.estimate} />
              </li>
            );
          })}
        </ol>
      </section>

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

      <div className="columns">
        <section aria-labelledby="top-india">
          <h2 id="top-india">{ui.topIndia}</h2>
          <p className="section-note">{ui.topIndiaNote}</p>
          <RankList list={indian.slice(0, 10)} native="INR" live />
          <a className="more" href={P('/india/')}>{ui.allIndian}</a>
        </section>
        <section aria-labelledby="top-world">
          <h2 id="top-world">{ui.topWorld}</h2>
          <WorldwideNote lang={lang} className="section-note" />
          <RankList list={worldwideTop(10)} native="USD" />
          <a className="more" href={P('/top/')}>{ui.top500}</a>
        </section>
      </div>

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

      <Html as="article" className="article prose" aria-labelledby="guide" html={c.article(STATS)} data-reveal="" />

      <FaqBlock items={faq} heading={ui.faqTitle} />
    </PageShell>
  );
}
