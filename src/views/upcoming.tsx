// Upcoming films: the /upcoming/ page (en + hi), the cards the home page's "Coming soon" section shares, and the page
// an upcoming film gets at /movie/<slug>/ until its first figure is reported (then src/views/film.tsx takes over the
// same address). Release dates are Wikidata's; advance booking is what the film's Wikipedia article reports.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Money } from '@/components/client/basics';
import { BoardBanner } from '@/components/client/film/BoardBanner';
import { ShareButton, Shelf } from '@/components/client/film/FilmBits';
import { ReleaseCountdown, ReleaseIn } from '@/components/client/Release';
import { PageShell } from '@/components/PageShell';
import { Ad, Crumbs, Html, JoinNodes, JsonLd, Poster } from '@/components/ui';
import {
  advanceOf, bannerUrl, BUILD_TIME, comingSoon, isOut, justOut, languageByName, nativeOf, notableFirst, personFor, posterUrl,
  upcoming, upcomingBySlug, wikiPosterUrl,
} from '@/lib/data';
import { countryName, formatDate, joinNames, slugify } from '@/lib/format';
import { alternatesFor, CONTENT, localePath, type Lang } from '@/lib/i18n';
import { releaseDate, releaseInText } from '@/lib/release';
import { crumbsLd, pageMetadata, type Crumb } from '@/lib/seo';
import { SITE } from '@/lib/site';
import type { UpcomingFilm } from '@/lib/types';

/** How far ahead the upcoming list looks (scripts/merge.mjs). */
const WINDOW_DAYS = 60;

const languageLabel = (f: UpcomingFilm, lang: Lang) => {
  const l = f.languages.map((n) => languageByName.get(n)).find(Boolean);
  return l ? (lang === 'hi' ? l.hi : l.name) : f.languages[0];
};

/** One upcoming film: poster, when it opens, title, language and director, and advance booking if reported. */
export function UpcomingCard({ film: f, lang }: { film: UpcomingFilm; lang: Lang }) {
  const ui = CONTENT[lang].ui;
  const advance = advanceOf(f);
  const meta = [languageLabel(f, lang), f.directors[0]].filter(Boolean);
  return (
    <li className="up-card" data-reveal="">
      <a className="up-link" href={`/movie/${f.slug}/`} hrefLang={lang !== 'en' ? 'en' : undefined}>
        <Poster film={f} />
        <span className="up-body">
          <span className={isOut(f) ? 'up-when is-out' : 'up-when'}>
            {isOut(f) ? <span className="live-dot" aria-hidden="true" /> : null}
            <ReleaseIn release={f.release} initial={releaseInText(f.release, BUILD_TIME, lang)} />
          </span>
          <b className="up-title">{f.title}</b>
          <span className="up-meta">{[releaseDate(f.release, lang, BUILD_TIME), ...meta].join(' · ')}</span>
          {advance ? (
            <span className="up-advance">
              {ui.advance} <b className="m"><Money usd={advance.usd} inr={advance.inr} native={nativeOf(f)} />{advance.approx ? '+' : ''}</b>
            </span>
          ) : null}
        </span>
      </a>
    </li>
  );
}

/** The home page's "Coming soon" row: large posters with a countdown badge, title, date and language, advance booking if reported. */
export function UpcomingShelf({ films, lang }: { films: UpcomingFilm[]; lang: Lang }) {
  const ui = CONTENT[lang].ui;
  return (
    <Shelf label={ui.upcomingTitle}>
      <ol className="poster-row">
        {films.map((f) => {
          const advance = advanceOf(f);
          return (
            <li className="pc" key={f.id}>
              <a className="pc-link" href={`/movie/${f.slug}/`} hrefLang={lang !== 'en' ? 'en' : undefined}>
                <span className="pc-art">
                  <Poster film={f} />
                  <span className="pc-when"><ReleaseIn release={f.release} initial={releaseInText(f.release, BUILD_TIME, lang, true)} short /></span>
                </span>
                <b className="pc-title">{f.title}</b>
                <span className="pc-meta">{[releaseDate(f.release, lang, BUILD_TIME), languageLabel(f, lang)].filter(Boolean).join(' · ')}</span>
                {advance ? (
                  <span className="pc-adv">{ui.advance} <b className="m"><Money usd={advance.usd} inr={advance.inr} native={nativeOf(f)} />{advance.approx ? '+' : ''}</b></span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ol>
    </Shelf>
  );
}

/** For the home page: the best-known films still to come (up to 6 Indian and 10 international), in release order. */
export const homeUpcoming = () => [
  ...notableFirst(comingSoon.filter((f) => f.indian)).slice(0, 6),
  ...notableFirst(comingSoon.filter((f) => !f.indian)).slice(0, 10),
].sort((a, b) => a.release.localeCompare(b.release) || b.sitelinks - a.sitelinks);

/** Groups for a list of upcoming films: Indian and international films still to come, then those just released with no figure yet. */
export function upcomingGroups(lang: Lang, pick: (list: UpcomingFilm[]) => UpcomingFilm[] = (l) => l) {
  const ui = CONTENT[lang].ui;
  return [
    { key: 'indian', title: ui.boardGroups.indian, films: pick(comingSoon.filter((f) => f.indian)) },
    { key: 'international', title: ui.boardGroups.international, films: pick(comingSoon.filter((f) => !f.indian)) },
    { key: 'out', title: ui.outNowTitle, films: pick(justOut) },
  ].filter((g) => g.films.length);
}

export function UpcomingGroups({ lang, idPrefix, groups }: {
  lang: Lang; idPrefix: string; groups: ReturnType<typeof upcomingGroups>;
}) {
  return groups.map((g) => (
    <div className="release-group" key={g.key}>
      <h3 id={`${idPrefix}-${g.key}`}>{g.title} <span className="release-count">{g.films.length}</span></h3>
      <ol className="up-cards" aria-labelledby={`${idPrefix}-${g.key}`}>
        {g.films.map((f) => <UpcomingCard key={f.id} film={f} lang={lang} />)}
      </ol>
    </div>
  ));
}

// ---------- /upcoming/ ----------

/** The calendar year(s) the next WINDOW_DAYS cover: "2026", or "2026–27" late in the year. */
const windowYears = (() => {
  const from = new Date(BUILD_TIME).getUTCFullYear();
  const to = new Date(BUILD_TIME + WINDOW_DAYS * 86_400_000).getUTCFullYear();
  return from === to ? String(from) : `${from}–${String(to).slice(-2)}`;
})();

const pageContent = (lang: Lang) => CONTENT[lang].pages.upcoming(upcoming.length, WINDOW_DAYS, windowYears);

export function upcomingMetadata(lang: Lang): Metadata {
  const p = pageContent(lang);
  return pageMetadata({
    lang, path: localePath(lang, '/upcoming/'), title: `${p.title} | ${SITE.name}`, description: p.description,
    alternates: alternatesFor('/upcoming/'),
  });
}

export function UpcomingPage({ lang }: { lang: Lang }) {
  const p = pageContent(lang);
  const crumbs: Crumb[] = [[CONTENT[lang].ui.home, localePath(lang, '/')], [p.h1, localePath(lang, '/upcoming/')]];
  const list = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: p.h1,
    itemListElement: upcoming.slice(0, 100).map((f, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE.url}/movie/${f.slug}/`, name: f.title })),
  };
  return (
    <PageShell lang={lang} nav="/upcoming/" alternates={alternatesFor('/upcoming/')}>
      <JsonLd data={[crumbsLd(crumbs), list]} />
      <Crumbs lang={lang} items={crumbs} />
      <div className="page-head"><h1>{p.h1}</h1><Html as="p" html={p.intro} /></div>
      <section className="release-section" aria-label={p.h1}>
        <UpcomingGroups lang={lang} idPrefix="up" groups={upcomingGroups(lang)} />
      </section>
      <Html as="p" className="note" html={p.note} />
    </PageShell>
  );
}

// ---------- /movie/<slug>/ for an upcoming film (English only, like every film page) ----------

export const isUpcomingSlug = (slug: string) => upcomingBySlug.has(slug);

function filmOf(slug: string): UpcomingFilm {
  const f = upcomingBySlug.get(slug);
  if (!f) throw new Error(`Unknown upcoming film: ${slug}`);
  return f;
}

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function upcomingMovieMetadata(slug: string): Metadata {
  const f = filmOf(slug);
  const advance = advanceOf(f);
  const when = formatDate(f.release);
  const amount = advance ? `${advance.approx ? 'over ' : ''}${formatMoneyText(advance, f)}` : null;
  return pageMetadata({
    lang: 'en',
    path: `/movie/${f.slug}/`,
    title: `${f.title}${f.year ? ` (${f.year})` : ''} release date, countdown${advance ? ' and advance booking' : ''} | ${SITE.name}`,
    description: `${f.title} ${isOut(f) ? 'released' : 'releases'} in cinemas on ${when}.${amount ? ` Advance booking: ${amount}, as reported.` : ''} Countdown to release, film details, and the live box office collection from its first reported figure.`,
    ogType: 'video.movie',
  });
}

/** Plain-text amount for metadata, in the film's own currency. */
function formatMoneyText(m: { usd: number; inr: number }, f: UpcomingFilm): string {
  return nativeOf(f) === 'INR' ? `₹${(m.inr / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 2 })} crore` : `$${(m.usd / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })} million`;
}

/** Posters you supply are served from this site (a path); structured data needs a full address. */
const absoluteUrl = (u: string) => (u.startsWith('/') ? `${SITE.url}${u}` : u);

export function UpcomingMoviePage({ slug }: { slug: string }) {
  const f = filmOf(slug);
  const native = nativeOf(f);
  const advance = advanceOf(f);
  const out = isOut(f);
  const poster = posterUrl(f, 330);
  const lang = f.languages.map((l) => languageByName.get(l)).find(Boolean);
  const wiki = `https://en.wikipedia.org/wiki/${encodeURIComponent(f.enwiki.replace(/ /g, '_'))}`;
  const crumbs: Crumb[] = [['Home', '/'], ['Upcoming films', '/upcoming/'], [f.title, `/movie/${f.slug}/`]];

  const meta = [lang?.name ?? f.languages[0], f.runtime ? `${Math.floor(f.runtime / 60)}h ${f.runtime % 60}m` : null, f.directors[0] ? `Directed by ${f.directors[0]}` : null]
    .filter((x): x is string => Boolean(x));
  const stats: { label: string; value: ReactNode; sub?: ReactNode }[] = [
    {
      label: 'Advance booking',
      value: advance ? <><Money usd={advance.usd} inr={advance.inr} native={native} />{advance.approx ? '+' : ''}</> : '—',
      sub: advance ? 'as reported on Wikipedia' : 'not reported yet',
    },
    { label: out ? 'Released' : 'Release', value: releaseDate(f.release, 'en', BUILD_TIME), sub: 'in cinemas' },
  ];
  if (f.budget) stats.push({ label: 'Budget', value: <Money usd={f.budget.usd} inr={f.budget.inr} native={native} />, sub: 'reported' });
  if (f.distributors.length) stats.push({ label: f.distributors.length > 1 ? 'Distributors' : 'Distributor', value: f.distributors.slice(0, 2).join(', ') });

  const facts: [string, ReactNode][] = [['Release', formatDate(f.release)]];
  if (f.date && f.date < f.release) facts.push(['First shown', formatDate(f.date)]);
  if (f.directors.length) facts.push([f.directors.length > 1 ? 'Directors' : 'Director', <JoinNodes key="d" items={f.directors.map(personLink)} />]);
  if (f.starring.length) facts.push(['Cast', <JoinNodes key="c" items={f.starring.map(personLink)} />]);
  if (f.languages.length) {
    facts.push([f.languages.length > 1 ? 'Languages' : 'Language', <JoinNodes key="l" items={f.languages.map((l) =>
      languageByName.get(l) ? <a key={l} href={`/language/${slugify(l)}/`}>{l}</a> : l)} />]);
  }
  if (f.countries.length) facts.push([f.countries.length > 1 ? 'Countries' : 'Country', joinNames(f.countries.map(countryName))]);
  if (f.runtime) facts.push(['Running time', `${f.runtime} minutes`]);
  if (f.imdb) facts.push(['IMDb', <a key="imdb" href={`https://www.imdb.com/title/${f.imdb}/`} rel="noopener">{f.imdb}</a>]);

  // Other upcoming films: the same kind (Indian or international) first, best known first.
  const others = notableFirst(upcoming.filter((x) => x.id !== f.id && !isOut(x)));
  const more = [...others.filter((x) => x.indian === f.indian), ...others.filter((x) => x.indian !== f.indian)].slice(0, 6);

  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'Movie', name: f.title, url: `${SITE.url}/movie/${f.slug}/`,
    ...(posterUrl(f, 500) && { image: absoluteUrl(posterUrl(f, 500)) }),
    datePublished: f.release,
    ...(f.runtime && { duration: `PT${f.runtime}M` }),
    ...(f.languages.length && { inLanguage: f.languages[0] }),
    ...(f.countries.length && { countryOfOrigin: { '@type': 'Country', name: countryName(f.countries[0]) } }),
    ...(f.directors.length && { director: f.directors.map((name) => ({ '@type': 'Person', name })) }),
    ...(f.starring.length && { actor: f.starring.map((name) => ({ '@type': 'Person', name })) }),
    sameAs: [wiki, `https://www.wikidata.org/wiki/${f.id}`, f.imdb && `https://www.imdb.com/title/${f.imdb}/`].filter(Boolean),
  }, crumbsLd(crumbs)];

  return (
    <PageShell lang="en" nav="/upcoming/">
      <JsonLd data={jsonld} />
      <Crumbs lang="en" items={crumbs} />

      <section className="board" aria-label="Release countdown">
        <div className="board-top">
          {bannerUrl(f) || poster ? <BoardBanner src={bannerUrl(f) || poster} wide={Boolean(bannerUrl(f))} fallback={wikiPosterUrl(f, 330)} /> : null}
          <div className="board-head">
            {poster ? <Poster film={f} eager /> : null}
            <div className="board-title">
              <p className="board-kicker">{out ? <><span className="live-dot" aria-hidden="true" />In cinemas</> : 'Coming soon'}</p>
              <h1>{f.title}</h1>
              {meta.length ? <p className="board-sub"><span>{meta.join(' · ')}</span></p> : null}
            </div>
            <div className="board-actions"><ShareButton title={`${f.title}: release date and box office`} /></div>
          </div>
          <ReleaseCountdown id={f.id} release={f.release} dateLine={`${longDate(f.release)} · India time`} />
        </div>
        <div className="board-stub">
          <dl className="stub-stats">
            {stats.map((s) => <div key={s.label}><dt>{s.label}</dt><dd className="m">{s.value}</dd>{s.sub ? <dd className="stub-sub">{s.sub}</dd> : null}</div>)}
          </dl>
        </div>
      </section>

      <Ad lang="en" />

      {advance ? (
        <section className="block" aria-labelledby="advance">
          <div className="block-head"><h2 id="advance">Advance booking</h2></div>
          <div className="block-card">
            <blockquote className="up-quote">{advance.quote}</blockquote>
            <p className="block-note">From the film’s <a href={wiki} rel="noopener">Wikipedia article</a>. Ticket pre-sales are reported by trade sources; this site does not track bookings itself.</p>
          </div>
        </section>
      ) : null}

      <section className="block" aria-labelledby="about">
        <div className="block-head"><h2 id="about">About the film</h2></div>
        <div className="block-card"><dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>
      </section>

      {more.length ? (
        <section className="release-section" aria-labelledby="more-upcoming">
          <div className="release-head">
            <div><h2 id="more-upcoming">Also coming soon</h2></div>
            <a className="see-all" href="/upcoming/">All upcoming films <span aria-hidden="true">›</span></a>
          </div>
          <ol className="up-cards">{more.map((x) => <UpcomingCard key={x.id} film={x} lang="en" />)}</ol>
        </section>
      ) : null}

      <p className="note">
        The release date comes from <a href={`https://www.wikidata.org/wiki/${f.id}`} rel="noopener">Wikidata</a> and can change. From release day this
        page shows the day of the run, and as soon as the film’s first collection figure is reported on <a href={wiki} rel="noopener">Wikipedia</a> it
        becomes its live box office page, with the running total updated every minute.
      </p>
    </PageShell>
  );
}

function personLink(name: string) {
  const p = personFor(name);
  return p ? <a key={name} href={`/person/${p.slug}/`}>{name}</a> : name;
}
