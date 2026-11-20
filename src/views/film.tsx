// Film and person pages (English only; see src/lib/i18n.ts).
import type { Metadata } from 'next';
import { Fragment, type ReactNode } from 'react';
import { Money } from '@/components/client/basics';
import { CollectionChart } from '@/components/client/CollectionChart';
import { LiveStatMain, StatMain } from '@/components/client/Live';
import { PageShell } from '@/components/PageShell';
import { Avatar, Crumbs, FilmLink, JoinNodes, JsonLd, PhotoCredit, Poster, RankList } from '@/components/ui';
import {
  artUrl, byYear, dailyRows, filmBySlug, releaseOf, films, isIndian, languageByName, MOJO_URL, nativeOf, people, personFor, photoFor, worldwideById,
} from '@/lib/data';
import { countryName, formatDate, formatMoney, formatShortDate, joinNames, slugify, type Currency } from '@/lib/format';
import { crumbsLd, itemListLd, pageMetadata, type Crumb } from '@/lib/seo';
import { SITE } from '@/lib/site';
import type { Film, Money as MoneyValue } from '@/lib/types';

const other = (c: Currency): Currency => (c === 'INR' ? 'USD' : 'INR');
const mojoLink = <a href={MOJO_URL}>Box Office Mojo</a>;

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
  return pageMetadata({
    lang: 'en',
    path: `/movie/${f.slug}/`,
    title: `${f.title}${yearText} box office collection${lastDay ? ` day ${lastDay}` : ''}: ${primary} worldwide | ${SITE.name}`,
    description: `${f.title}${yearText} box office collection: ${primary} (${formatMoney(f.gross, other(native))}) worldwide${
      f.budget ? ` on a budget of ${formatMoney(f.budget, native)}` : ''}. Catalog rank #${f.rank}${
      yearRank ? `, #${yearRank} of ${f.year}` : ''}${lastDay ? `, with day-wise collection up to day ${lastDay}` : ''}.`,
    ogType: 'video.movie',
  });
}

export function MoviePage({ slug }: { slug: string }) {
  const { f, native, yearList, yearRank, lang, days, crumbs, wiki } = movieContent(slug);
  const g = f.gross;
  const langRank = lang ? lang.list.indexOf(f) + 1 : 0;
  const label = `${g.scope === 'worldwide' ? 'Worldwide gross' : 'Box office'}${g.approx ? ', estimated' : ''}`;
  const range = g.high && g.low && g.high > g.low ? (
    <span className="range">
      Reported range <Money usd={Math.round(g.usd)} inr={g.inr} native={native} /> to{' '}
      <Money usd={Math.round((g.usd * g.high) / g.low)} inr={Math.round((g.inr * g.high) / g.low)} native={native} />
    </span>
  ) : null;

  const money = (m: MoneyValue, cur: Currency = native) => <Money {...m} native={cur} />;
  const facts: [string, ReactNode][] = [];
  const reference = worldwideById.get(f.id);
  if (reference) facts.push(['Worldwide lifetime gross', <Fragment key="mojo"><Money {...reference.gross} exact /> · #{reference.rank} on {mojoLink}</Fragment>]);
  if (f.budget) {
    facts.push(['Budget', money(f.budget)]);
    const x = g.usd / f.budget.usd;
    facts.push(['Earned', `${x >= 10 ? Math.round(x) : x.toFixed(1)} times its budget`]);
  }
  if (f.domestic) facts.push(['US and Canada', money(f.domestic)]);
  if (f.india) facts.push(['India', money(f.india, 'INR')]);
  if (f.date) facts.push(['Released', formatDate(f.date)]);
  if (f.runtime) facts.push(['Running time', `${f.runtime} minutes`]);
  if (f.languages.length) {
    facts.push([f.languages.length > 1 ? 'Languages' : 'Language', <JoinNodes key="languages" items={f.languages.map((l) =>
      languageByName.get(l) ? <a key={l} href={`/language/${slugify(l)}/`}>{l}</a> : l)} />]);
  }
  if (f.countries.length) facts.push([f.countries.length > 1 ? 'Countries' : 'Country', joinNames(f.countries.map(countryName))]);

  // Cast and crew with photos (directors first, then the billed cast), and credits for the Commons photos.
  const crew = [
    ...f.directors.map((name) => ({ name, role: 'Director' })),
    ...f.starring.filter((n) => !f.directors.includes(n)).map((name) => ({ name, role: 'Cast' })),
  ].map((c) => ({ ...c, person: personFor(c.name), photo: photoFor(c.name) }));
  const photoCredits = crew.filter((c) => c.photo?.credit);

  // Same-year comparison: top 10, plus this film if it is further down.
  const compare = yearRank > 10 ? [...yearList.slice(0, 10), f] : yearList.slice(0, 10);
  const star = f.starring.map(personFor).find(Boolean);
  const moreWithStar = star ? star.films.filter((x) => x.id !== f.id).slice(0, 6) : [];

  const sources: ReactNode[] = [];
  if (wiki) sources.push(<a key="wp" href={wiki} rel="noopener">Wikipedia</a>);
  sources.push(<a key="wd" href={`https://www.wikidata.org/wiki/${f.id}`} rel="noopener">Wikidata</a>);
  if (f.imdb) sources.push(<a key="imdb" href={`https://www.imdb.com/title/${f.imdb}/`} rel="noopener">IMDb</a>);
  const poster = artUrl(f, 'poster', 'w342');

  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'Movie', name: f.title, url: `${SITE.url}/movie/${f.slug}/`,
    ...(artUrl(f, 'poster', 'w500') && { image: artUrl(f, 'poster', 'w500') }),
    ...(f.date && { datePublished: f.date }),
    ...(f.runtime && { duration: `PT${f.runtime}M` }),
    ...(f.languages.length && { inLanguage: f.languages[0] }),
    ...(f.countries.length && { countryOfOrigin: { '@type': 'Country', name: countryName(f.countries[0]) } }),
    ...(f.directors.length && { director: f.directors.map((name) => ({ '@type': 'Person', name })) }),
    ...(f.starring.length && { actor: f.starring.map((name) => ({ '@type': 'Person', name })) }),
    sameAs: [wiki, `https://www.wikidata.org/wiki/${f.id}`, f.imdb && `https://www.imdb.com/title/${f.imdb}/`].filter(Boolean),
  }, crumbsLd(crumbs)];

  const stat = { gross: { usd: g.usd, inr: g.inr }, native, label, range };
  return (
    <PageShell lang="en">
      <JsonLd data={jsonld} />
      <Crumbs lang="en" items={crumbs} />
      <header className={`film-head${poster ? ' has-poster' : ''}`}>
        {poster ? <Poster film={f} eager /> : null}
        <div>
          <h1>{f.title}</h1>
          <p>
            {[f.year, f.languages.length ? `${joinNames(f.languages)} film` : 'Film'].filter(Boolean).join(' ')}
            {f.directors.length ? `, directed by ${joinNames(f.directors)}` : ''}
          </p>
        </div>
      </header>

      {/* The headline figure, then the film's ranks in a row like an App Store info bar. */}
      <div className="stat-card" role="group" aria-label="Box office summary">
        {f.live ? <LiveStatMain {...stat} live={f.live} /> : <StatMain {...stat} />}
        <ul className="stat-ranks">
          <li><span className="rank"><b>#{f.rank}</b> <small>in catalog</small></span></li>
          {yearRank ? <li><a className="rank" href={`/year/${f.year}/`}><b>#{yearRank}</b> <small>of {f.year}</small></a></li> : null}
          {lang && langRank ? <li><a className="rank" href={`/language/${lang.slug}/`}><b>#{langRank}</b> <small>in {lang.name}</small></a></li> : null}
        </ul>
      </div>

      <dl className="facts">
        {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>

      {crew.length ? (
        <section aria-labelledby="cast">
          <h2 id="cast">Cast and crew</h2>
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
              <ul>
                {photoCredits.map((c) => <li key={c.name}>{c.name}: <PhotoCredit credit={c.photo!.credit!} /></li>)}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      {days.length > 1 ? (
        <section aria-labelledby="daily">
          <h2 id="daily">Day-wise box office collection</h2>
          <p className="section-note">Worldwide total as it stood on Wikipedia at the end of each day, India time. Days without a new report are left out, so one row can cover more than one day.</p>
          <CollectionChart days={days} release={releaseOf(f)} native={native} live={f.live} gross={{ usd: g.usd, inr: g.inr }} />
          <div className="table-scroll" data-reveal="">
            <table className="daywise">
              <thead><tr><th scope="col">Day</th><th scope="col">Date</th><th scope="col">Reported total</th><th scope="col">Added</th></tr></thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.day}><td>Day {d.day}</td><td>{formatShortDate(d.date)}</td><td>{money(d.total)}</td><td>{money(d.added)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {f.year && yearList.length > 1 ? (
        <section aria-labelledby="year-compare">
          <h2 id="year-compare">Biggest films of {f.year}</h2>
          <RankList list={compare} native={native} highlight={f.id} rankOf={(x) => yearList.indexOf(x as Film) + 1} max={yearList[0].gross.usd} live />
          <a className="more" href={`/year/${f.year}/`}>All {yearList.length} films from {f.year}</a>
        </section>
      ) : null}

      {star && moreWithStar.length ? (
        <section aria-labelledby="more-star">
          <h2 id="more-star">More with {star.name}</h2>
          <RankList list={moreWithStar} native={native} rankOf={(x) => star.films.indexOf(x as Film) + 1} max={star.films[0].gross.usd} />
          <a className="more" href={`/person/${star.slug}/`}>All {star.films.length} films</a>
        </section>
      ) : null}

      <p className="note">
        Sources: {sources.flatMap((s, i) => (i ? [', ', s] : [s]))}.
        {g.asOf ? ` Figure as of ${formatDate(g.asOf)}.` : ''}{' '}
        {g.source === 'wikipedia' && g.text ? `Wikipedia lists the gross as “${g.text}”.` : ''}
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
