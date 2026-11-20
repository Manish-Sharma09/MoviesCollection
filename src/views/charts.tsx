// Ranked lists: all-time (/top/), Indian films, the crore clubs, years and languages. All translated.
import type { Metadata } from 'next';
import { Money } from '@/components/client/basics';
import { PageShell } from '@/components/PageShell';
import { Crumbs, FilmLink, Html, JsonLd, ListBody, RankList } from '@/components/ui';
import {
  byYear, clubBySlug, CLUBS, indian, isIndian, languageBySlug, languages, nativeOf, STATS, worldwide, yearsSorted,
} from '@/lib/data';
import { alternatesFor, CONTENT, localePath, type Lang } from '@/lib/i18n';
import { crumbsLd, itemListLd, pageMetadata, type Crumb } from '@/lib/seo';
import { SITE } from '@/lib/site';
import type { ClubSlug } from '@/lib/types';
import { langName } from './home';
import { worldwideNoteHtml } from './shared';

const withSite = (title: string) => `${title} | ${SITE.name}`;
const meta = (lang: Lang, path: string, p: { title: string; description: string }): Metadata =>
  pageMetadata({ lang, path: localePath(lang, path), title: withSite(p.title), description: p.description, alternates: alternatesFor(path) });

// ---------- /top/ ----------

export const topMetadata = (lang: Lang) => meta(lang, '/top/', CONTENT[lang].pages.top(STATS));

export function TopPage({ lang }: { lang: Lang }) {
  const p = CONTENT[lang].pages.top(STATS);
  return (
    <PageShell lang={lang} nav="/top/" alternates={alternatesFor('/top/')}>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'ItemList', name: p.h1,
        itemListElement: worldwide.map((f) => ({
          '@type': 'ListItem', position: f.rank, name: f.title, ...(f.slug && { url: `${SITE.url}/movie/${f.slug}/` }),
        })),
      }} />
      <ListBody lang={lang} h1={p.h1} introHtml={worldwideNoteHtml(lang)} list={worldwide} native="USD" exact />
    </PageShell>
  );
}

// ---------- /india/ ----------

export const indiaMetadata = (lang: Lang) => meta(lang, '/india/', CONTENT[lang].pages.india(STATS));

export function IndiaPage({ lang }: { lang: Lang }) {
  const p = CONTENT[lang].pages.india(STATS);
  return (
    <PageShell lang={lang} nav="/india/" alternates={alternatesFor('/india/')}>
      <JsonLd data={itemListLd(indian, p.h1)} />
      <ListBody lang={lang} h1={p.h1} introHtml={p.intro} list={indian} native="INR" />
    </PageShell>
  );
}

// ---------- /club/[slug]/ ----------

export const clubParams = () => CLUBS.map((c) => ({ slug: c.slug }));

function clubContent(lang: Lang, slug: string) {
  const club = clubBySlug.get(slug as ClubSlug);
  if (!club) throw new Error(`Unknown club: ${slug}`);
  const c = CONTENT[lang];
  const label = c.club[club.slug].label;
  const crumbs: Crumb[] = [[c.ui.home, localePath(lang, '/')], [label, localePath(lang, `/club/${slug}/`)]];
  return { club, label, crumbs, p: c.pages.club(c.club[club.slug], club.list.length) };
}

export const clubMetadata = (lang: Lang, slug: string) => meta(lang, `/club/${slug}/`, clubContent(lang, slug).p);

export function ClubPage({ lang, slug }: { lang: Lang; slug: string }) {
  const { club, label, crumbs, p } = clubContent(lang, slug);
  return (
    <PageShell lang={lang} alternates={alternatesFor(`/club/${slug}/`)}>
      <JsonLd data={[itemListLd(club.list, label), crumbsLd(crumbs)]} />
      <ListBody lang={lang} h1={label} introHtml={p.intro} list={club.list} native={club.native} limit={2000} crumbs={crumbs} />
    </PageShell>
  );
}

// ---------- /years/ ----------

export const yearsMetadata = (lang: Lang) => meta(lang, '/years/', CONTENT[lang].pages.years(STATS));

export function YearsPage({ lang }: { lang: Lang }) {
  const c = CONTENT[lang];
  const p = c.pages.years(STATS);
  return (
    <PageShell lang={lang} nav="/years/" alternates={alternatesFor('/years/')}>
      <div className="page-head"><h1>{p.h1}</h1><Html as="p" html={p.intro} /></div>
      <section className="list-section">
        <ul className="years">
          {yearsSorted.map((y) => {
            const list = byYear.get(y)!;
            const f = list[0];
            return (
              <li key={y} data-reveal="">
                <span className="y"><a href={localePath(lang, `/year/${y}/`)}>{y}</a></span>
                <span><FilmLink film={f} /><small><Money {...f.gross} native={nativeOf(f)} />, {c.ui.filmsCount(list.length)}</small></span>
              </li>
            );
          })}
        </ul>
      </section>
    </PageShell>
  );
}

// ---------- /year/[year]/ ----------

export const yearParams = () => yearsSorted.map((y) => ({ year: String(y) }));

function yearContent(lang: Lang, yearParam: string) {
  const y = Number(yearParam);
  const list = byYear.get(y);
  if (!list) throw new Error(`Unknown year: ${yearParam}`);
  const ind = list.filter(isIndian);
  const c = CONTENT[lang];
  const crumbs: Crumb[] = [[c.ui.home, localePath(lang, '/')], [c.ui.nav.years, localePath(lang, '/years/')], [String(y), localePath(lang, `/year/${y}/`)]];
  return { y, list, ind, crumbs, p: c.pages.year(y, list.length, ind.length) };
}

export const yearMetadata = (lang: Lang, year: string) => meta(lang, `/year/${year}/`, yearContent(lang, year).p);

export function YearPage({ lang, year }: { lang: Lang; year: string }) {
  const { y, list, ind, crumbs, p } = yearContent(lang, year);
  const ui = CONTENT[lang].ui;
  return (
    <PageShell lang={lang} alternates={alternatesFor(`/year/${y}/`)}>
      <JsonLd data={[crumbsLd(crumbs), itemListLd(list, p.h1)]} />
      <Crumbs lang={lang} items={crumbs} />
      <div className="page-head"><h1>{p.h1}</h1><Html as="p" html={p.intro} /></div>
      <div className="columns">
        {ind.length ? (
          <section aria-labelledby="y-in"><h2 id="y-in">{ui.indianFilms}</h2><RankList list={ind.slice(0, 100)} native="INR" /></section>
        ) : null}
        <section aria-labelledby="y-all"><h2 id="y-all">{ui.allFilms}</h2><RankList list={list.slice(0, 100)} native="USD" /></section>
      </div>
    </PageShell>
  );
}

// ---------- /language/[slug]/ ----------

export const languageParams = () => languages.map((l) => ({ slug: l.slug }));

function languageContent(lang: Lang, slug: string) {
  const l = languageBySlug.get(slug);
  if (!l) throw new Error(`Unknown language: ${slug}`);
  const name = langName(lang, l);
  const crumbs: Crumb[] = [[CONTENT[lang].ui.home, localePath(lang, '/')], [name, localePath(lang, `/language/${slug}/`)]];
  return { l, crumbs, p: CONTENT[lang].pages.language(name, l.list.length) };
}

export const languageMetadata = (lang: Lang, slug: string) => meta(lang, `/language/${slug}/`, languageContent(lang, slug).p);

export function LanguagePage({ lang, slug }: { lang: Lang; slug: string }) {
  const { l, crumbs, p } = languageContent(lang, slug);
  return (
    <PageShell lang={lang} alternates={alternatesFor(`/language/${slug}/`)}>
      <JsonLd data={[crumbsLd(crumbs), itemListLd(l.list, p.h1)]} />
      <ListBody lang={lang} h1={p.h1} introHtml={p.intro} list={l.list} native={l.native} crumbs={crumbs} />
    </PageShell>
  );
}
