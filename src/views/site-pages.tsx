// About, contact, privacy policy and terms (translated), and the 404 / 500 pages.
import type { Metadata } from 'next';
import { SearchBox } from '@/components/client/SearchBox';
import { PageShell } from '@/components/PageShell';
import { Crumbs, Html, JsonLd } from '@/components/ui';
import type { ProseKey } from '@/content/types';
import { STATS } from '@/lib/data';
import { alternatesFor, CONTENT, localePath, type Lang } from '@/lib/i18n';
import { crumbsLd, pageMetadata, type Crumb } from '@/lib/seo';
import { SITE } from '@/lib/site';

// ---------- plain text pages ----------

function proseContent(lang: Lang, key: ProseKey) {
  const page = CONTENT[lang].pages[key](STATS);
  const crumbs: Crumb[] = [[CONTENT[lang].ui.home, localePath(lang, '/')], [page.h1, localePath(lang, `/${key}/`)]];
  return { page, crumbs };
}

export function proseMetadata(lang: Lang, key: ProseKey): Metadata {
  const { page } = proseContent(lang, key);
  return pageMetadata({
    lang, path: localePath(lang, `/${key}/`), title: `${page.title} | ${SITE.name}`, description: page.description,
    alternates: alternatesFor(`/${key}/`),
  });
}

export function ProsePage({ lang, page: key }: { lang: Lang; page: ProseKey }) {
  const { page, crumbs } = proseContent(lang, key);
  return (
    <PageShell lang={lang} nav={key === 'about' ? '/about/' : null} alternates={alternatesFor(`/${key}/`)}>
      <JsonLd data={crumbsLd(crumbs)} />
      <Crumbs lang={lang} items={crumbs} />
      <div className="page-head">
        <h1>{page.h1}</h1>
        {page.lead ? <Html as="p" html={page.lead} /> : null}
      </div>
      <Html className="prose" html={page.body} />
    </PageShell>
  );
}

// ---------- errors ----------
// Rendered at /error-404/, /hi/error-404/ and /error-500/; scripts/postbuild.mjs moves them to 404.html,
// hi/404.html and 500.html, which Cloudflare Pages serves for missing pages (nearest 404.html wins).

export function notFoundMetadata(lang: Lang): Metadata {
  const e = CONTENT[lang].errors;
  return pageMetadata({ lang, path: localePath(lang, '/404'), title: `${e.notFoundTitle} | ${SITE.name}`, description: e.notFoundTitle, noindex: true });
}

export function NotFoundPage({ lang }: { lang: Lang }) {
  const c = CONTENT[lang];
  const e = c.errors;
  return (
    <PageShell lang={lang} ads={false}>
      <div className="page-head error-page">
        <p className="error-code">404</p>
        <Html as="h1" html={e.notFoundH1} />
        <Html as="p" html={e.notFoundText} />
      </div>
      <SearchBox variant="big" label={c.ui.searchLabel} placeholder={c.ui.searchPlaceholderBig} />
      <p className="error-links">
        <a href={localePath(lang, '/')}>{e.goHome}</a> <a href={localePath(lang, '/top/')}>{c.ui.nav.topLong}</a>
      </p>
    </PageShell>
  );
}

export const serverErrorMetadata = (): Metadata =>
  pageMetadata({ lang: 'en', path: '/500', title: `${CONTENT.en.errors.serverTitle} | ${SITE.name}`, description: CONTENT.en.errors.serverTitle, noindex: true });

export function ServerErrorPage() {
  const { en, hi } = CONTENT;
  return (
    <PageShell lang="en" ads={false}>
      <div className="page-head error-page">
        <p className="error-code">500</p>
        <Html as="h1" html={en.errors.serverH1} />
        <Html as="p" html={en.errors.serverText} />
        <Html as="p" lang="hi" html={hi.errors.serverText} />
      </div>
      <p className="error-links">
        <a href="/">{en.errors.goHome}</a> <a href="/hi/" lang="hi">{hi.errors.goHome}</a>
      </p>
    </PageShell>
  );
}
