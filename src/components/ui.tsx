// Server components shared by the pages. Interactive pieces live in ./client.
import Image from 'next/image';
import { Fragment, type HTMLAttributes, type ReactNode } from 'react';
import { personFor, posterUrl, type Photo, type PosterWidth } from '@/lib/data';
import type { Currency } from '@/lib/format';
import { CONTENT, type Lang } from '@/lib/i18n';
import type { Crumb } from '@/lib/seo';
import { ADSENSE_CLIENT, ADSENSE_SLOT } from '@/lib/site';
import type { RankItem } from '@/lib/types';
import { AdSlot } from './client/AdSlot';
import { Money, SafeImg } from './client/basics';
import { RankValue } from './client/Live';

/** HTML from src/content (article, FAQ, legal pages). Data inside it is escaped where it is written. */
export function Html({ as: Tag = 'div', html, ...rest }: {
  as?: 'div' | 'p' | 'article' | 'span' | 'h1';
  html: string;
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'dangerouslySetInnerHTML'>) {
  return <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** An ad slot, when an AdSense ad unit is set up (ADSENSE_CLIENT and ADSENSE_SLOT); otherwise nothing. */
export function Ad({ lang }: { lang: Lang }) {
  return ADSENSE_CLIENT && ADSENSE_SLOT ? <AdSlot client={ADSENSE_CLIENT} slot={ADSENSE_SLOT} label={CONTENT[lang].ui.adLabel} /> : null;
}

export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <>
      {[data].flat().map((x, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(x).replace(/</g, '\\u003c') }} />
      ))}
    </>
  );
}

/** The icon's adjacent site name provides the accessible link text. */
export function AppIcon() {
  return <Image className="app-icon" src="/favicon.svg" width={30} height={30} alt="" unoptimized />;
}

/** Poster with the title's first letter behind it, shown when there is no artwork or it fails to load. */
export function Poster({ film, eager = false, size = 330 }: { film: { title: string; id?: string; slug?: string }; eager?: boolean; size?: PosterWidth }) {
  const url = posterUrl(film, size);
  return (
    <span className="poster" aria-hidden="true">
      <span className="poster-letter">{film.title.trim().slice(0, 1)}</span>
      {url ? (
        <SafeImg src={url} alt="" width={342} height={513} decoding="async" {...(eager ? { fetchPriority: 'high' } : { loading: 'lazy' })} />
      ) : null}
    </span>
  );
}

/** A round photo of a person, over their initials (shown when there is no photo or it fails to load). */
export function Avatar({ name, photo, size = 'md', eager = false }: { name: string; photo: Photo | null; size?: 'md' | 'lg'; eager?: boolean }) {
  const initials = name.split(/[\s.-]+/).map((w) => w[0]).filter((ch) => ch && /\p{L}/u.test(ch)).slice(0, 2).join('').toUpperCase();
  const px = size === 'lg' ? 160 : 88;
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      <span className="avatar-initials">{initials}</span>
      {photo ? (
        <SafeImg src={photo.url} alt="" width={px} height={px} decoding="async" {...(eager ? { fetchPriority: 'high' } : { loading: 'lazy' })} />
      ) : null}
    </span>
  );
}

/** "Photo: Jane Doe, CC BY-SA 4.0, via Wikimedia Commons", with links, for a Commons photo. */
export function PhotoCredit({ credit }: { credit: Photo['credit'] }) {
  return (
    <>
      {credit.artist ? <>{credit.artist}, </> : null}
      {credit.license ? (credit.licenseUrl ? <><a href={credit.licenseUrl} rel="noopener license">{credit.license}</a>, </> : <>{credit.license}, </>) : null}
      via <a href={credit.page} rel="noopener">Wikimedia Commons</a>
    </>
  );
}

export function FilmLink({ film }: { film: { slug?: string; title: string } }) {
  return film.slug ? <a href={`/movie/${film.slug}/`}>{film.title}</a> : <>{film.title}</>;
}

export function PersonLink({ name }: { name: string }) {
  const p = personFor(name);
  return p ? <a href={`/person/${p.slug}/`}>{name}</a> : <>{name}</>;
}

/** "A, B and C" with React nodes. */
export function JoinNodes({ items, lang = 'en' }: { items: ReactNode[]; lang?: Lang }) {
  return items.map((item, i) => (
    <Fragment key={i}>
      {i > 0 ? (i === items.length - 1 ? ` ${lang === 'hi' ? 'और' : 'and'} ` : ', ') : null}
      {item}
    </Fragment>
  ));
}

export function Crumbs({ lang, items }: { lang: Lang; items: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label={CONTENT[lang].ui.breadcrumb}>
      <ol>
        {items.map(([name, path], i) =>
          i === items.length - 1
            ? <li key={path} aria-current="page">{name}</li>
            : <li key={path}><a href={path}>{name}</a></li>)}
      </ol>
    </nav>
  );
}

export interface RankListOptions {
  /** 'INR' | 'USD' for the whole list, or each film's own currency. */
  native?: Currency | ((f: RankItem) => Currency);
  highlight?: string | null;
  rankOf?: ((f: RankItem) => number) | null;
  max?: number | null;
  /** What to show next to the title (the year by default). */
  sub?: (f: RankItem) => ReactNode;
  /** Add live estimates for films in cinemas. */
  live?: boolean;
  exact?: boolean;
}

export function RankList({ list, native = 'USD', highlight = null, rankOf = null, max = null, sub = (f) => f.year ?? '', live = false, exact = false }: { list: RankItem[] } & RankListOptions) {
  const top = max || list[0]?.gross.usd || 1;
  // Posters on every row (they load lazily, as they scroll into view); if the list has any artwork,
  // rows without it get a letter tile so the titles line up.
  const withPosters = list.slice(0, 50).some((f) => posterUrl(f, 120));
  return (
    <ol className="ranks">
      {list.map((f, i) => {
        const pct = Math.max(1, Math.round((f.gross.usd / top) * 100));
        const here = Boolean(f.id) && f.id === highlight;
        const cur = typeof native === 'function' ? native(f) : native;
        return (
          <li key={f.id || `${f.title}-${f.year}`} className={here ? 'here' : undefined} aria-current={here ? 'true' : undefined}>
            <span className="n">{rankOf ? rankOf(f) : i + 1}</span>
            <span className="t">
              {withPosters ? <Poster film={f} size={120} /> : null}
              <span><FilmLink film={f} /><small>{sub(f)}</small></span>
            </span>
            {live && f.live
              ? <RankValue gross={f.gross} native={cur} exact={exact} live={f.live} />
              : <span className="v"><Money usd={f.gross.usd} inr={f.gross.inr} native={cur} exact={exact} /></span>}
            <span className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
          </li>
        );
      })}
    </ol>
  );
}

export function FaqBlock({ items, heading }: { items: { q: string; a: string }[]; heading: string }) {
  return (
    <section className="faq" aria-labelledby="faq">
      <h2 id="faq">{heading}</h2>
      <div className="faq-list" data-reveal="">
        {items.map(({ q, a }) => (
          <details key={q}>
            <summary>{q}</summary>
            <Html className="faq-a" html={a} />
          </details>
        ))}
      </div>
    </section>
  );
}

/** Heading, intro and a ranked list: the all-time, Indian, club and language pages. */
export function ListBody({ lang, h1, introHtml, list, native, limit = 500, crumbs = null, exact = false, headLink = null, sub }: {
  lang: Lang; h1: string; introHtml: string; list: RankItem[]; native: Currency; limit?: number; crumbs?: Crumb[] | null; exact?: boolean;
  /** One link under the intro, to the same chart another way (reported ↔ adjusted for inflation). */
  headLink?: { href: string; label: string } | null;
  sub?: RankListOptions['sub'];
}) {
  return (
    <>
      {crumbs ? <Crumbs lang={lang} items={crumbs} /> : null}
      <div className="page-head">
        <h1>{h1}</h1><Html as="p" html={introHtml} />
        {headLink ? <a className="see-all head-link" href={headLink.href}>{headLink.label} <span aria-hidden="true">›</span></a> : null}
      </div>
      <section className="list-section"><RankList list={list.slice(0, limit)} native={native} exact={exact} {...(sub && { sub })} /></section>
    </>
  );
}
