// Film and person pages (English only; see src/lib/i18n.ts).
import type { Metadata } from 'next';
import { type ReactNode } from 'react';
import { Money } from '@/components/client/basics';
import { CollectionChart } from '@/components/client/CollectionChart';
import { BoardReadout, type MarketTab } from '@/components/client/film/Board';
import { BoardBanner } from '@/components/client/film/BoardBanner';
import { RunDay, Shelf, TabbedBlock } from '@/components/client/film/FilmBits';
import type { CardData } from '@/components/client/film/share-card';
import { ShareMenu } from '@/components/client/film/ShareMenu';
import { HeadToHead } from '@/components/client/film/HeadToHead';
import { MilestoneStrip } from '@/components/client/film/MilestoneStrip';
import { BoardCollection } from '@/components/client/Live';
import { ImdbRating } from '@/components/ImdbRating';
import { PageShell } from '@/components/PageShell';
import { Ad, Avatar, Crumbs, FilmLink, JoinNodes, JsonLd, PhotoCredit, Poster, RankList } from '@/components/ui';
import {
  BUILD_TIME, byYear, dailyRows, filmBySlug, releaseOf, films, inCinemas, isIndian, languageByName, marketsOf, nativeOf, people,
  personFor, photoFor, posterUrl, worldwideById, bannerUrl, wikiPosterUrl,
} from '@/lib/data';
import {
  alsoInCinemas, crossings, dayEntries, headToHead, milestoneStep, records, runDay, weekEntries, type DayEntry,
} from '@/lib/film-stats';
import { countryName, formatDate, formatMoney, joinNames, slugify, type Currency } from '@/lib/format';
import { adjustedOf, adjustedRank, CPI_YEAR, worthShowing } from '@/lib/inflation';
import { crumbsLd, itemListLd, pageMetadata, type Crumb } from '@/lib/seo';
import { SITE } from '@/lib/site';
import type { Film, FilmFacts, Money as MoneyValue } from '@/lib/types';

const other = (c: Currency): Currency => (c === 'INR' ? 'USD' : 'INR');

// ---------- /movie/[slug]/ ----------

export const movieParams = () => films.map((f) => ({ slug: f.slug }));

function movieContent(slug: string) {
  const f = filmBySlug.get(slug);
  if (!f) throw new Error(`Unknown film: ${slug}`);
  const native = nativeOf(f);
  const yearList = (f.year && byYear.get(f.year)) || [];
  const yearRank = yearList.indexOf(f) + 1;
  const lang = f.languages.map((l) => languageByName.get(l)).find(Boolean);
  const days = dailyRows(f);
  const lastDay = days.length > 1 ? days.at(-1)!.day : null;
  const crumbs: Crumb[] = [['Home', '/'], ...(f.year ? [[String(f.year), `/year/${f.year}/`] as Crumb] : []),
    ...(lang ? [[lang.name, `/language/${lang.slug}/`] as Crumb] : []), [f.title, `/movie/${f.slug}/`]];
  const wiki = f.enwiki && `https://en.wikipedia.org/wiki/${encodeURIComponent(f.enwiki.replace(/ /g, '_'))}`;
  return { f, native, yearList, yearRank, lang, days, lastDay, crumbs, wiki };
}

export function movieMetadata(slug: string): Metadata {
  const { f, native, yearRank, lastDay } = movieContent(slug);
  const yearText = f.year ? ` (${f.year})` : '';
  const primary = formatMoney(f.gross, native);
  const adjusted = adjustedOf(f);
  return pageMetadata({
    lang: 'en',
    path: `/movie/${f.slug}/`,
    title: `${f.title}${yearText} box office collection${lastDay ? ` day ${lastDay}` : ''}: ${primary} worldwide | ${SITE.name}`,
    description: `${f.title}${yearText} box office collection: ${primary} (${formatMoney(f.gross, other(native))}) worldwide${
      f.budget ? ` on a budget of ${formatMoney(f.budget, native)}` : ''}. Catalog rank #${f.rank}${
      yearRank ? `, #${yearRank} of ${f.year}` : ''}${lastDay ? `, with day-wise collection up to day ${lastDay}` : ''}.${
      worthShowing(adjusted) ? ` About ${formatMoney(adjusted.money, native)} in ${CPI_YEAR} prices.` : ''}`,
    ogType: 'video.movie',
  });
}

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayMonth = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const times = (x: number) => (x >= 10 ? String(Math.round(x)) : x.toFixed(1));

/** ▲ 12% / ▼ 8% against the previous day: arrow and words carry the meaning, colour only repeats it. */
function Change({ change, against }: { change: number | null; against: string }) {
  if (change === null || !Number.isFinite(change)) return <span className="change" />;
  const up = change >= 0;
  const pct = Math.abs(change) >= 9.995 ? `${Math.round(Math.abs(change)).toLocaleString('en-IN')}×` : `${Math.round(Math.abs(change) * 100)}%`;
  return (
    <span className={up ? 'change up' : 'change down'} title={`${up ? 'Up' : 'Down'} ${pct} on the previous ${against}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span><span className="sr-only">{up ? 'up' : 'down'}</span> {pct}
    </span>
  );
}

function DayRow({ d, max, native }: { d: DayEntry; max: number; native: Currency }) {
  return (
    <li className="day-row">
      <span className="day-when">
        <b>{d.from === d.day ? shortDay(d.date) : `${dayMonth(d.date)} (${d.day - d.from + 1} days)`}</b>
        <small>{d.from === d.day ? `Day ${d.day}` : `Days ${d.from}–${d.day}`}</small>
      </span>
      <span className="day-bar" aria-hidden="true">
        <i data-w={Math.min(1, d.perDay.usd / max).toFixed(3)} style={{ transform: `scaleX(${Math.min(1, d.perDay.usd / max)})` }} />
      </span>
      <span className="day-amt m"><Money {...d.added} native={native} /></span>
      <Change change={d.change} against={d.from === d.day ? 'day' : 'report'} />
    </li>
  );
}

/** A titled section: the heading sits on the page, the content in a card under it. */
function Block({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="block" aria-labelledby={id}>
      <div className="block-head"><h2 id={id}>{title}</h2>{action}</div>
      <div className="block-card">{children}</div>
    </section>
  );
}

/** Posters you supply are served from this site (a path); structured data needs a full address. */
const absoluteUrl = (u: string) => (u.startsWith('/') ? `${SITE.url}${u}` : u);

export function MoviePage({ slug }: { slug: string }) {
  const { f, native, yearList, yearRank, lang, crumbs, wiki } = movieContent(slug);
  const g = f.gross;
  const langRank = lang ? lang.list.indexOf(f) + 1 : 0;
  const label = `${g.scope === 'worldwide' ? 'Worldwide gross' : 'Box office'}${g.approx ? ', estimated' : ''}`;
  const range = g.high && g.low && g.high > g.low ? (
    <span>
      reported range <Money usd={Math.round(g.usd)} inr={g.inr} native={native} />–<Money usd={Math.round((g.usd * g.high) / g.low)} inr={Math.round((g.inr * g.high) / g.low)} native={native} />
    </span>
  ) : null;
  const money = (m: MoneyValue, cur: Currency = native) => <Money {...m} native={cur} />;

  // ---- the board ----
  const release = f.daily?.length ? releaseOf(f) : f.date;
  const showing = inCinemas.includes(f);
  const poster = posterUrl(f, 330);
  const meta: string[] = [];
  if (f.date) meta.push(f.date.endsWith('-01-01') ? String(f.year) : `Released ${formatDate(f.date)}`);
  if (f.languages.length) meta.push(lang?.name ?? f.languages[0]);
  if (f.runtime) meta.push(`${Math.floor(f.runtime / 60)}h ${f.runtime % 60}m`);
  // Indian films always get the Overseas and India net buttons; a market Wikipedia does not state says so.
  const split = marketsOf(f);
  const markets: MarketTab[] = f.indian ? [
    { key: 'overseas', label: 'Overseas', value: split?.overseas ?? null },
    split?.indiaNet || !split?.indiaGross
      ? { key: 'india-net', label: 'India net', value: split?.indiaNet ?? null }
      : { key: 'india-net', label: 'India net', value: split.indiaGross, note: 'India gross (the net figure is not stated)' },
  ] : [];

  const reference = worldwideById.get(f.id);
  const stats: { label: string; value: ReactNode; sub?: ReactNode }[] = [];
  if (f.budget) stats.push({ label: 'Budget', value: money(f.budget), sub: `earned ${times(g.usd / f.budget.usd)}× back` });
  if (f.year && yearRank) stats.push({ label: `Rank in ${f.year}`, value: <a href={`/year/${f.year}/`}>#{yearRank}</a>, sub: `of ${yearList.length} films` });
  if (lang && langRank) stats.push({ label: `Rank in ${lang.name}`, value: <a href={`/language/${lang.slug}/`}>#{langRank.toLocaleString('en-IN')}</a>, sub: 'all time' });
  if (reference) stats.push({ label: 'All-time chart', value: <a href="/top/">#{reference.rank}</a>, sub: 'worldwide' });
  const adjusted = adjustedOf(f);
  if (worthShowing(adjusted)) {
    const place = (f.indian ? adjustedRank.india : adjustedRank.world).get(f.id);
    stats.push({
      label: `In ${CPI_YEAR} prices`, value: money(adjusted.money),
      sub: place ? <a href={f.indian ? '/india/adjusted/' : '/top/adjusted/'}>#{place} adjusted for inflation</a> : 'adjusted for inflation',
    });
  }
  if (f.domestic) stats.push({ label: 'US and Canada', value: money(f.domestic, 'USD') });

  // ---- daily, comparisons, records ----
  const days = dayEntries(f);
  const weeks = weekEntries(f, days).reverse();
  const maxDay = Math.max(1, ...days.map((d) => d.perDay.usd));
  const recs = records(days, weekEntries(f, days));
  const lastTotal = days.at(-1)?.total;
  const step = lastTotal ? milestoneStep(native === 'INR' ? lastTotal.inr : lastTotal.usd, native) : 0;
  const passed = lastTotal ? crossings(days, native, step) : [];
  const versus = headToHead(f, days);
  const also = showing ? alsoInCinemas(f) : [];
  const fmtNative = (n: number) => formatMoney({ usd: n, inr: n }, native);

  // ---- people and facts ----
  const crew = [
    ...f.directors.map((name) => ({ name, role: 'Director' })),
    ...f.starring.filter((n) => !f.directors.includes(n)).map((name) => ({ name, role: 'Cast' })),
  ].map((c) => ({ ...c, person: personFor(c.name), photo: photoFor(c.name) }));
  const photoCredits = crew.filter((c) => c.photo?.credit);
  const facts: [string, ReactNode][] = [];
  if (f.date) facts.push(['Released', formatDate(f.date)]);
  if (f.directors.length) facts.push([f.directors.length > 1 ? 'Directors' : 'Director', joinNames(f.directors)]);
  if (f.runtime) facts.push(['Running time', `${f.runtime} minutes`]);
  if (f.languages.length) {
    facts.push([f.languages.length > 1 ? 'Languages' : 'Language', <JoinNodes key="languages" items={f.languages.map((l) =>
      languageByName.get(l) ? <a key={l} href={`/language/${slugify(l)}/`}>{l}</a> : l)} />]);
  }
  if (f.countries.length) facts.push([f.countries.length > 1 ? 'Countries' : 'Country', joinNames(f.countries.map(countryName))]);
  if (f.imdb) facts.push(['IMDb', <a key="imdb" href={`https://www.imdb.com/title/${f.imdb}/`} rel="noopener">{f.imdb}</a>]);

  const compare = yearRank > 10 ? [...yearList.slice(0, 10), f] : yearList.slice(0, 10);
  const star = f.starring.map(personFor).find(Boolean);
  const moreWithStar = star ? star.films.filter((x) => x.id !== f.id).slice(0, 6) : [];

  const sources: ReactNode[] = [];
  if (wiki) sources.push(<a key="wp" href={wiki} rel="noopener">Wikipedia</a>);
  sources.push(<a key="wd" href={`https://www.wikidata.org/wiki/${f.id}`} rel="noopener">Wikidata</a>);
  if (f.imdb) sources.push(<a key="imdb" href={`https://www.imdb.com/title/${f.imdb}/`} rel="noopener">IMDb</a>);

  // What the compare tool reads from this page, and what the share image shows.
  const host = (() => { try { return new URL(SITE.url).host; } catch { return SITE.name; } })();
  const filmFacts: FilmFacts = {
    slug: f.slug, title: f.title, year: f.year, date: f.date, language: lang?.name ?? f.languages[0] ?? null,
    director: f.directors[0] ?? null, stars: f.starring.slice(0, 3), poster: posterUrl(f, 330), native,
    gross: { usd: g.usd, inr: g.inr }, budget: f.budget ? { usd: f.budget.usd, inr: f.budget.inr } : null,
    adjusted: adjusted ? { usd: Math.round(adjusted.money.usd), inr: Math.round(adjusted.money.inr) } : null,
    adjustedYear: adjusted ? CPI_YEAR : null,
    yearRank: yearRank || null, yearCount: yearList.length, chartRank: reference?.rank ?? null,
    indiaNet: split?.indiaNet ?? null, overseas: split?.overseas ?? null,
    opening: recs.openingDay?.added ?? null,
    biggestDay: (recs.biggestDay ?? recs.openingDay)?.added ?? null,
    days: days.map((d) => [d.day, Math.round(d.total.usd), Math.round(d.total.inr)]),
    live: f.live ?? null, showing,
  };
  const card: CardData = {
    slug: f.slug, title: f.title, poster: posterUrl(f, 500) || poster, kicker: f.year ? `Box office · ${f.year}` : 'Box office',
    release: showing ? release : null, showing, native, gross: { usd: g.usd, inr: g.inr }, live: f.live ?? null,
    label: g.scope === 'worldwide' ? 'Worldwide gross' : 'Box office',
    stats: [
      ...(f.budget ? [{ label: 'Budget', money: { usd: f.budget.usd, inr: f.budget.inr } }] : []),
      ...(f.year && yearRank ? [{ label: `Rank in ${f.year}`, text: `#${yearRank} of ${yearList.length}` }] : []),
      ...(worthShowing(adjusted) ? [{ label: `In ${CPI_YEAR} prices`, money: adjusted.money }]
        : reference ? [{ label: 'All-time chart', text: `#${reference.rank} worldwide` }] : []),
    ],
    site: SITE.name, host,
  };

  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'Movie', name: f.title, url: `${SITE.url}/movie/${f.slug}/`,
    ...(posterUrl(f, 500) && { image: absoluteUrl(posterUrl(f, 500)) }),
    ...(f.date && { datePublished: f.date }),
    ...(f.runtime && { duration: `PT${f.runtime}M` }),
    ...(f.languages.length && { inLanguage: f.languages[0] }),
    ...(f.countries.length && { countryOfOrigin: { '@type': 'Country', name: countryName(f.countries[0]) } }),
    ...(f.directors.length && { director: f.directors.map((name) => ({ '@type': 'Person', name })) }),
    ...(f.starring.length && { actor: f.starring.map((name) => ({ '@type': 'Person', name })) }),
    sameAs: [wiki, `https://www.wikidata.org/wiki/${f.id}`, f.imdb && `https://www.imdb.com/title/${f.imdb}/`].filter(Boolean),
  }, crumbsLd(crumbs)];

  const gross = { usd: g.usd, inr: g.inr };
  return (
    <PageShell lang="en">
      <JsonLd data={jsonld} />
      <script type="application/json" id="film-facts" dangerouslySetInnerHTML={{ __html: JSON.stringify(filmFacts).replace(/</g, '\\u003c') }} />
      <Crumbs lang="en" items={crumbs} />

      <section className="board" aria-label="Box office board">
        <div className="board-top">
          {bannerUrl(f) || poster ? <BoardBanner src={bannerUrl(f) || poster} wide={Boolean(bannerUrl(f))} fallback={wikiPosterUrl(f, 330)} /> : null}
          <div className="board-head">
            {poster ? <Poster film={f} eager /> : null}
            <div className="board-title">
              <p className="board-kicker">
                {showing && release ? <><span className="live-dot" aria-hidden="true" /><RunDay release={release} initial={runDay(release, BUILD_TIME)} /> in cinemas</> : 'Box office'}
              </p>
              <h1>{f.title}</h1>
              {meta.length || f.rating ? (
                <p className="board-sub">
                  {f.rating ? <ImdbRating value={f.rating.value} votes={f.rating.votes} imdb={f.imdb} /> : null}
                  {meta.length ? <span>{meta.join(' · ')}</span> : null}
                </p>
              ) : null}
            </div>
            <div className="board-actions">
              <a className="share-button" href={`/compare/?a=${f.slug}`}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.5 2 5l2.5 2.5M2 5h9M11.5 8.5 14 11l-2.5 2.5M14 11H5" /></svg>
                <span>Compare</span>
              </a>
              <ShareMenu title={`${f.title} box office collection`} card={card} />
            </div>
          </div>
          <BoardReadout gross={gross} native={native} live={f.live} label={label} range={range} markets={markets} />
        </div>
        {stats.length || (f.live && showing && days.length) ? (
          <div className="board-stub">
            {stats.length ? (
              <dl className="stub-stats">
                {stats.map((s) => <div key={s.label}><dt>{s.label}</dt><dd className="m">{s.value}</dd>{s.sub ? <dd className="stub-sub">{s.sub}</dd> : null}</div>)}
              </dl>
            ) : null}
            {f.live && showing && days.length && release ? <MilestoneStrip native={native} gross={gross} live={f.live} step={step} release={release} /> : null}
          </div>
        ) : null}
      </section>

      <Ad lang="en" />

      {days.length > 1 ? (
        <TabbedBlock id="daily" title="Daily collection" labels={['Each day', 'Running total']}
          footer={<p className="block-foot"><span>Reported so far</span><b className="m">{lastTotal ? money(lastTotal) : null}</b></p>}>
          {[
            <div key="days">
              {weeks.map((w, i) => (
                <details key={w.week} className="week" open={i === 0}>
                  <summary>
                    <span className="week-chev" aria-hidden="true" />
                    <b>Week {w.week}</b>
                    <small>{dayMonth(w.start)} – {dayMonth(w.end)}</small>
                    <span className="m">{money(w.added)}</span>
                  </summary>
                  <ol className="days">{[...w.days].reverse().map((d) => <DayRow key={d.day} d={d} max={maxDay} native={native} />)}</ol>
                </details>
              ))}
              {markets.length ? <p className="block-note">Daily figures are for the worldwide total.</p> : null}
            </div>,
            <CollectionChart key="chart" bare days={dailyRows(f)} release={releaseOf(f)} native={native} live={f.live} gross={gross} />,
          ]}
        </TabbedBlock>
      ) : null}

      {versus ? (
        <Block id="versus" title="Versus similar releases"
          action={<a className="see-all" href={`/compare/?a=${f.slug}&b=${versus[1].slug}`}>Full comparison <span aria-hidden="true">›</span></a>}>
          <HeadToHead series={versus} native={native} />
        </Block>
      ) : null}

      {passed.length || recs.openingDay || recs.biggestDay ? (
        <Block id="records" title="Records">
          <dl className="records">
            {recs.openingDay ? <div className="record"><dt>Opening day</dt><dd className="m">{money(recs.openingDay.added)}</dd><dd>{shortDay(recs.openingDay.date)}</dd></div> : null}
            {recs.biggestDay ? <div className="record"><dt>Biggest day</dt><dd className="m">{money(recs.biggestDay.added)}</dd><dd>{shortDay(recs.biggestDay.date)} · Day {recs.biggestDay.day}</dd></div> : null}
            {recs.bestWeek ? <div className="record"><dt>Best week</dt><dd className="m">{money(recs.bestWeek.added)}</dd><dd>Week {recs.bestWeek.week}</dd></div> : null}
            {passed.length ? <div className="record"><dt>Last milestone</dt><dd className="m">{fmtNative(passed.at(-1)!.value)}</dd><dd>reached on Day {passed.at(-1)!.day}</dd></div> : null}
          </dl>
        </Block>
      ) : null}

      {crew.length || facts.length ? (
        <Block id="about" title="About the film">
          {facts.length ? <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : null}
          {crew.length ? (
            <>
              <h3 className="block-sub">Cast and crew</h3>
              <ul className="cast-row">
                {crew.map(({ name, role, person, photo }) => {
                  const inner = <><Avatar name={name} photo={photo} /><span className="cast-name">{name}</span><span className="cast-role">{role}</span></>;
                  return (
                    <li key={`${role}-${name}`} data-reveal="">
                      {person ? <a className="cast-card" href={`/person/${person.slug}/`}>{inner}</a> : <span className="cast-card">{inner}</span>}
                    </li>
                  );
                })}
              </ul>
              {photoCredits.length ? (
                <details className="photo-credits">
                  <summary>Photo credits</summary>
                  <ul>{photoCredits.map((c) => <li key={c.name}>{c.name}: <PhotoCredit credit={c.photo!.credit} /></li>)}</ul>
                </details>
              ) : null}
            </>
          ) : null}
        </Block>
      ) : null}

      {f.year && yearList.length > 1 ? (
        <Block id="year-top" title={`Top films of ${f.year}`} action={<a className="see-all" href={`/year/${f.year}/`}>All {yearList.length} <span aria-hidden="true">›</span></a>}>
          <RankList list={compare} native={native} highlight={f.id} rankOf={(x) => yearList.indexOf(x as Film) + 1} max={yearList[0].gross.usd} live />
        </Block>
      ) : null}

      {star && moreWithStar.length ? (
        <Block id="star" title={`${star.name}’s other films`} action={<a className="see-all" href={`/person/${star.slug}/`}>All {star.films.length} <span aria-hidden="true">›</span></a>}>
          <RankList list={moreWithStar} native={native} rankOf={(x) => star.films.indexOf(x as Film) + 1} max={star.films[0].gross.usd} />
        </Block>
      ) : null}

      {also.length ? (
        <Block id="showing" title="Now showing" action={<a className="see-all" href="/live/">Live board <span aria-hidden="true">›</span></a>}>
          <Shelf label="films in cinemas">
            <ol className="also-list">
              {also.map((a) => (
                <li key={a.slug} className="also-card">
                  <span className="poster" aria-hidden="true">
                    <span className="poster-letter">{a.title.trim().slice(0, 1)}</span>
                    {a.poster ? <img src={a.poster} alt="" width={120} height={180} loading="lazy" decoding="async" /> : null}
                  </span>
                  <span className="also-info">
                    <a href={`/movie/${a.slug}/`}>{a.title}</a>
                    <small><RunDay release={a.release} initial={runDay(a.release, BUILD_TIME)} /></small>
                    <BoardCollection gross={a.gross} native={a.native} live={a.live ?? undefined} reported="Reported" estimate="Running total" />
                  </span>
                </li>
              ))}
            </ol>
          </Shelf>
        </Block>
      ) : null}

      <aside className="fix-it">
        <div>
          <h2>Number looks wrong?</h2>
          <p>Our figures come from the film’s Wikipedia article. Fix it there with a source and it updates here at the next refresh.</p>
        </div>
        <div className="fix-it-actions">
          {wiki ? <a className="button button-secondary" href={wiki} rel="noopener">Fix on Wikipedia</a> : null}
          <a className="button button-dark" href="/contact/">Report it</a>
        </div>
      </aside>

      <p className="note">
        Sources: {sources.flatMap((s, i) => (i ? [', ', s] : [s]))}.
        {g.asOf ? ` Figure as of ${formatDate(g.asOf)}.` : ''}{' '}
        {g.source === 'wikipedia' && g.text ? `Wikipedia lists the gross as “${g.text}”.` : ''}{' '}
        Other sites may quote a different figure: <a href="/guides/why-box-office-figures-differ/">here is why</a>.
      </p>
    </PageShell>
  );
}

// ---------- /person/[slug]/ ----------

export const personParams = () => [...people.keys()].map((slug) => ({ slug }));

function personContent(slug: string) {
  const p = people.get(slug);
  if (!p) throw new Error(`Unknown person: ${slug}`);
  const total = p.films.reduce((s, f) => ({ usd: s.usd + f.gross.usd, inr: s.inr + f.gross.inr }), { usd: 0, inr: 0 });
  const native: Currency = p.films.filter(isIndian).length > p.films.length / 2 ? 'INR' : 'USD';
  const crumbs: Crumb[] = [['Home', '/'], [p.name, `/person/${p.slug}/`]];
  return { p, total, native, crumbs, photo: photoFor(p.name) };
}

export function personMetadata(slug: string): Metadata {
  const { p, total, native } = personContent(slug);
  return pageMetadata({
    lang: 'en',
    path: `/person/${p.slug}/`,
    title: `${p.name} box office collection: all ${p.films.length} films ranked | ${SITE.name}`,
    description: `${p.name}'s films ranked by worldwide box office collection. ${p.films.length} films, ${formatMoney(total, native)} in total. Biggest: ${p.films[0].title}.`,
  });
}

export function PersonPage({ slug }: { slug: string }) {
  const { p, total, native, crumbs, photo } = personContent(slug);
  const role = p.roles.has('actor') && p.roles.has('director') ? 'actor and director' : p.roles.has('director') ? 'director' : 'actor';
  return (
    <PageShell lang="en">
      <JsonLd data={[
        crumbsLd(crumbs), itemListLd(p.films, `${p.name} films by box office collection`),
        { '@context': 'https://schema.org', '@type': 'Person', name: p.name, url: `${SITE.url}/person/${p.slug}/`, ...(photo && { image: photo.url }) },
      ]} />
      <Crumbs lang="en" items={crumbs} />
      <div className="page-head person-head">
        <Avatar name={p.name} photo={photo} size="lg" eager />
        <div>
          <h1>{p.name}</h1>
          <p>{p.films.length} films as {role}, <Money {...total} native={native} /> worldwide in total. Biggest so far: <FilmLink film={p.films[0]} />.</p>
          {photo?.credit ? <p className="photo-credit">Photo: <PhotoCredit credit={photo.credit} /></p> : null}
        </div>
      </div>
      <section className="list-section"><RankList list={p.films} native={native} /></section>
    </PageShell>
  );
}
